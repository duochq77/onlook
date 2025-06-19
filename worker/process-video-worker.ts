import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express, { Request, Response, Express } from 'express'
import fetch from 'node-fetch'

console.log('🚀 process-video-worker.ts khởi động...')

// 🔐 Biến môi trường
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    PORT = 8080
} = process.env

// 🧪 Kiểm tra biến môi trường
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET || !REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.')
}

// 🔌 Supabase + Redis TCP
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const redis = new Redis({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {} // Bắt buộc với Upstash TCP
})

// 📥 Tải file từ URL
const downloadFile = async (url: string, dest: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`❌ Không tải được file: ${url}`)
    const fileStream = fs.createWriteStream(dest)
    await new Promise<void>((resolve, reject) => {
        res.body?.pipe(fileStream)
        res.body?.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

// ⏱ Lấy thời lượng media
const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err)
            resolve(metadata.format.duration || 0)
        })
    })
}

// 🔁 Lặp media đến thời lượng nhất định
const loopMedia = (input: string, output: string, duration: number) => {
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(input)
            .inputOptions('-stream_loop', '-1')
            .outputOptions('-t', `${duration}`)
            .save(output)
            .on('end', resolve)
            .on('error', reject)
    })
}

// ✂️ Cắt media theo thời lượng
const cutMedia = (input: string, output: string, duration: number) => {
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(input)
            .setDuration(duration)
            .save(output)
            .on('end', resolve)
            .on('error', reject)
    })
}

// 🧠 Xử lý từng job
const processJob = async (job: any) => {
    console.log(`📦 Bắt đầu xử lý job ${job.jobId}`)

    const tmpDir = path.join(os.tmpdir(), `onlook-${job.jobId}`)
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.mkdirSync(tmpDir)

    const inputVideo = path.join(tmpDir, 'input.mp4')
    const inputAudio = path.join(tmpDir, 'input.mp3')
    const cleanVideo = path.join(tmpDir, 'clean.mp4')
    const finalVideo = path.join(tmpDir, 'final.mp4')
    const finalAudio = path.join(tmpDir, 'final.mp3')
    const mergedOutput = path.join(tmpDir, 'output.mp4')

    try {
        await downloadFile(job.videoUrl, inputVideo)
        await downloadFile(job.audioUrl, inputAudio)

        // ✂️ Tách audio khỏi video
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(inputVideo)
                .noAudio()
                .save(cleanVideo)
                .on('end', resolve)
                .on('error', reject)
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)
        console.log(`⏱ Duration: video = ${videoDur}, audio = ${audioDur}`)

        // ⚙️ Cân chỉnh độ dài giữa video/audio
        if (Math.abs(videoDur - audioDur) < 1) {
            fs.copyFileSync(cleanVideo, finalVideo)
            fs.copyFileSync(inputAudio, finalAudio)
        } else if (videoDur < audioDur) {
            await loopMedia(cleanVideo, finalVideo, audioDur)
            await cutMedia(finalVideo, finalVideo, audioDur)
            fs.copyFileSync(inputAudio, finalAudio)
        } else if (videoDur > audioDur && videoDur / audioDur < 1.2) {
            await cutMedia(cleanVideo, finalVideo, audioDur)
            fs.copyFileSync(inputAudio, finalAudio)
        } else {
            fs.copyFileSync(cleanVideo, finalVideo)
            await loopMedia(inputAudio, finalAudio, videoDur)
            await cutMedia(finalAudio, finalAudio, videoDur)
        }

        // 🔗 Ghép lại finalVideo + finalAudio → output.mp4
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(finalVideo)
                .input(finalAudio)
                .outputOptions('-c:v copy', '-c:a aac', '-shortest')
                .save(mergedOutput)
                .on('end', resolve)
                .on('error', reject)
        })

        // ⬆️ Upload kết quả
        const buffer = fs.readFileSync(mergedOutput)
        const outputPath = `outputs/${job.outputName}`
        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(outputPath, buffer, {
            upsert: true,
            contentType: 'video/mp4'
        })

        // 🧹 Xoá nguyên liệu gốc trên Supabase
        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`
        ])
    } catch (err) {
        console.error(`❌ Lỗi job ${job.jobId}:`, err)
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        console.log(`🧽 Dọn RAM job ${job.jobId}`)
    }
}

// 🔄 Worker nền
const startWorker = async () => {
    console.log('👷 Worker nền đang chạy...')
    while (true) {
        try {
            const jobStr = await redis.lpop('onlook:job-queue')
            if (jobStr) {
                const job = JSON.parse(jobStr)
                await processJob(job)
            } else {
                console.log('⏳ Không có job trong hàng đợi...')
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        } catch (err) {
            console.error('❌ Lỗi vòng lặp worker:', err)
        }
    }
}

// 🌐 Health check
const app: Express = express()
app.get('/', (req: Request, res: Response) => {
    res.send('🟢 Worker hoạt động')
})
app.listen(Number(PORT), () => {
    console.log(`🌐 Listening on port ${PORT}`)
})

// 🚀 Khởi chạy worker nền
startWorker()
