import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express, { Request, Response } from 'express'
import fetch from 'node-fetch'
import { Readable } from 'stream'

// 📥 Biến môi trường
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

// ✅ Kết nối Supabase & Redis
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const redis = new Redis({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {}
})

redis.on('error', err => console.error('Redis error:', err))

// 🎞 Tải file về buffer
const downloadFile = async (url: string): Promise<Buffer> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Không tải được: ${url}`)
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
            .on('end', () => resolve())
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
            .on('end', () => resolve())
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
            .on('end', () => resolve())
            .on('error', reject)
            .run()
    })
}

// 🛠 Xử lý 1 job
const processJob = async (job: any) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `job-${job.jobId}-`))
    const inputVideo = path.join(tmp, 'video.mp4')
    const inputAudio = path.join(tmp, 'audio.mp3')
    const cleanVideo = path.join(tmp, 'clean.mp4')
    const finalVideo = path.join(tmp, 'final.mp4')
    const finalAudio = path.join(tmp, 'final.mp3')
    const outputFile = path.join(tmp, 'merged.mp4')

    try {
        const videoBuffer = await downloadFile(job.videoUrl)
        const audioBuffer = await downloadFile(job.audioUrl)
        await saveBufferToFile(videoBuffer, inputVideo)
        await saveBufferToFile(audioBuffer, inputAudio)

        // Tách audio khỏi video gốc
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(inputVideo)
                .noAudio()
                .output(cleanVideo)
                .on('end', () => resolve())
                .on('error', reject)
                .run()
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)

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

        await mergeMedia(finalVideo, finalAudio, outputFile)

        const outputPath = `outputs/${job.outputName}`
        const uploadRes = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(outputPath, fs.readFileSync(outputFile), {
            contentType: 'video/mp4',
            upsert: true
        })
        if (uploadRes.error) throw uploadRes.error

        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`
        ])
    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true })
    }
}

// 🔁 Worker loop
const startWorker = async () => {
    console.log('👷 Worker nền đang chạy...')
    while (true) {
        try {
            const jobStr = await redis.lpop('onlook:job-queue')
            if (jobStr) {
                const job = JSON.parse(jobStr)
                await processJob(job)
            } else {
                await new Promise(r => setTimeout(r, 2000))
            }
        } catch (err) {
            console.error('❌ Lỗi trong worker:', err)
        }
    }
}

// 🌐 Express server để Cloud Run healthcheck
const app = express()
app.use(express.json())

app.get('/', (_req: Request, res: Response) => {
    res.send('🟢 Worker hoạt động')
})

app.post('/', (_req: Request, res: Response) => {
    res.status(200).send('OK')
})

app.listen(Number(PORT), () => {
    console.log(`🌐 Server lắng nghe tại PORT ${PORT}`)
})

// ▶️ Bắt đầu worker
startWorker()
