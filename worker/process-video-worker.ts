import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express, { Request, Response } from 'express'
import fetch from 'node-fetch'

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    PORT = '8080'
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET || !REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const redis = new Redis({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {}
})

redis.on('error', err => console.error('❌ Redis error:', err))

const downloadFile = async (url: string): Promise<Buffer> => {
    if (!url || !url.startsWith('http')) throw new Error(`❌ URL không hợp lệ: ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Không tải được file từ: ${url}`)
    return Buffer.from(await res.arrayBuffer())
}

const saveBufferToFile = async (buffer: Buffer, filePath: string) => {
    await fs.promises.writeFile(filePath, buffer)
}

const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err)
            else resolve(metadata.format.duration ?? 0)
        })
    })
}

const loopMedia = (input: string, output: string, duration: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(input)
            .inputOptions('-stream_loop', '-1')
            .outputOptions('-t', `${duration}`)
            .output(output)
            .on('end', resolve)
            .on('error', reject)
            .run()
    })
}

const cutMedia = (input: string, output: string, duration: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(input)
            .setDuration(duration)
            .output(output)
            .on('end', resolve)
            .on('error', reject)
            .run()
    })
}

const mergeMedia = (video: string, audio: string, output: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(video)
            .input(audio)
            .outputOptions('-c:v copy', '-c:a aac', '-shortest')
            .output(output)
            .on('end', resolve)
            .on('error', reject)
            .run()
    })
}

const processJob = async (job: any) => {
    console.log('📦 Đã nhận job:', job.jobId)
    if (!job?.videoUrl?.startsWith('http') || !job?.audioUrl?.startsWith('http')) {
        console.error('❌ Job thiếu URL tuyệt đối:', job)
        return
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `job-${job.jobId}-`))
    const inputVideo = path.join(tmp, 'video.mp4')
    const inputAudio = path.join(tmp, 'audio.mp3')
    const cleanVideo = path.join(tmp, 'clean.mp4')
    const finalVideo = path.join(tmp, 'final.mp4')
    const finalAudio = path.join(tmp, 'final.mp3')
    const outputFile = path.join(tmp, 'merged.mp4')

    try {
        console.log('⬇️ Tải video...')
        const videoBuffer = await downloadFile(job.videoUrl)
        console.log('⬇️ Tải audio...')
        const audioBuffer = await downloadFile(job.audioUrl)
        await saveBufferToFile(videoBuffer, inputVideo)
        await saveBufferToFile(audioBuffer, inputAudio)

        console.log('✂️ Tách video sạch...')
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(inputVideo)
                .noAudio()
                .output(cleanVideo)
                .on('end', resolve)
                .on('error', reject)
                .run()
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)
        console.log(`📏 Duration video: ${videoDur}s, audio: ${audioDur}s`)

        if (Math.abs(videoDur - audioDur) < 1) {
            fs.copyFileSync(cleanVideo, finalVideo)
            fs.copyFileSync(inputAudio, finalAudio)
        } else if (videoDur < audioDur) {
            await loopMedia(cleanVideo, finalVideo, audioDur)
            await cutMedia(finalVideo, finalVideo, audioDur)
            fs.copyFileSync(inputAudio, finalAudio)
        } else {
            await cutMedia(cleanVideo, finalVideo, audioDur)
            fs.copyFileSync(inputAudio, finalAudio)
        }

        console.log('🎬 Ghép video + audio...')
        await mergeMedia(finalVideo, finalAudio, outputFile)

        const outputPath = `outputs/${job.outputName}`
        const result = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(outputPath, fs.readFileSync(outputFile), {
                contentType: 'video/mp4',
                upsert: true
            })

        if (result.error) throw result.error
        console.log(`✅ Đã upload kết quả lên Supabase: ${outputPath}`)

        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`
        ])
        console.log('🧹 Đã xoá 2 file nguyên liệu')

    } catch (err) {
        console.error(`❌ Lỗi khi xử lý job ${job.jobId}:`, err)
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true })
    }
}

const startWorker = async () => {
    console.log('👷 Worker nền đang chạy...')

    // Kiểm tra hàng đợi lần đầu
    redis.lrange('video-process-jobs', 0, -1).then(jobs => {
        console.log('📦 Hàng đợi Redis hiện tại:', jobs)
    })

    while (true) {
        console.log('🔄 Worker kiểm tra hàng đợi...')
        try {
            const jobStr = await redis.lpop('video-process-jobs')
            console.log('📥 Job từ Redis:', jobStr)

            if (!jobStr) {
                await new Promise(resolve => setTimeout(resolve, 3000))
                continue
            }

            let job
            try {
                job = JSON.parse(jobStr)
            } catch (err) {
                console.error('❌ Lỗi JSON.parse:', err)
                console.error('🪵 Dữ liệu lỗi:', jobStr)
                continue
            }

            await processJob(job)
        } catch (err) {
            console.error('❌ Lỗi trong vòng lặp worker:', err)
            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    }
}

const app = express()
app.use(express.json())

app.get('/', (_req: Request, res: Response) => {
    res.send('🟢 process-video-worker hoạt động')
})

app.post('/', (_req: Request, res: Response) => {
    res.status(200).send('OK')
})

app.listen(Number(PORT), () => {
    console.log(`🌐 Server lắng nghe tại PORT ${PORT}`)
})

startWorker()
