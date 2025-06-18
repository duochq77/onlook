import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express from 'express'
import fetch from 'node-fetch'

console.log('🚀 Worker process-video-worker.ts khởi động')

// 🔐 Biến môi trường
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET!
const redisUrl = process.env.UPSTASH_REDIS_REST_URL!
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const redis = new Redis({ url: redisUrl, token: redisToken })

const downloadFile = async (url: string, filePath: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Không thể tải file từ: ${url}`)
    const fileStream = fs.createWriteStream(filePath)
    await new Promise<void>((resolve, reject) => {
        res.body?.pipe(fileStream)
        res.body?.on('error', reject)
        fileStream.on('finish', () => resolve())
    })
}

const getDuration = async (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err)
            resolve(metadata.format.duration || 0)
        })
    })
}

const loopMedia = async (input: string, output: string, duration: number) => {
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(input)
            .inputOptions('-stream_loop', '-1')
            .outputOptions('-t', `${duration}`)
            .save(output)
            .on('end', () => resolve())
            .on('error', reject)
    })
}

const cutMedia = async (input: string, output: string, duration: number) => {
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(input)
            .setDuration(duration)
            .save(output)
            .on('end', () => resolve())
            .on('error', reject)
    })
}

const processJob = async (job: any) => {
    console.log('📦 Job nhận được:', job)

    const tmpDir = path.join(os.tmpdir(), `onlook-job-${job.jobId}`)
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.mkdirSync(tmpDir)

    const inputVideo = path.join(tmpDir, 'input.mp4')
    const inputAudio = path.join(tmpDir, 'input.mp3')
    const cleanVideo = path.join(tmpDir, 'clean.mp4')
    const finalVideo = path.join(tmpDir, 'final.mp4')
    const finalAudio = path.join(tmpDir, 'final.mp3')
    const mergedOutput = path.join(tmpDir, 'output.mp4')

    try {
        console.log('📥 Tải video...')
        await downloadFile(job.videoUrl, inputVideo)

        console.log('📥 Tải audio...')
        await downloadFile(job.audioUrl, inputAudio)

        console.log('✂️ Tách audio khỏi video...')
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(inputVideo)
                .noAudio()
                .save(cleanVideo)
                .on('end', () => resolve())
                .on('error', reject)
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)
        console.log(`🎯 Độ dài: video = ${videoDur}, audio = ${audioDur}`)

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

        console.log('🔀 Ghép video và audio...')
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(finalVideo)
                .input(finalAudio)
                .outputOptions('-c:v copy', '-c:a aac', '-shortest')
                .save(mergedOutput)
                .on('end', () => resolve())
                .on('error', reject)
        })

        const buffer = fs.readFileSync(mergedOutput)
        const outputPath = `outputs/${job.outputName}`

        console.log('☁️ Upload lên Supabase:', outputPath)
        await supabase.storage.from(supabaseStorageBucket).upload(outputPath, buffer, {
            upsert: true,
            contentType: 'video/mp4',
        })

        console.log('🧹 Xóa file gốc trên Supabase...')
        await supabase.storage.from(supabaseStorageBucket).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`,
        ])
    } catch (err) {
        console.error('❌ Lỗi xử lý job:', err)
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        console.log('🧹 Dọn RAM xong')
    }
}

const startWorker = async () => {
    console.log('👷 Worker nền đang chạy...')

    while (true) {
        try {
            const jobStr = await redis.lpop('onlook:job-queue')
            if (typeof jobStr === 'string') {
                const job = JSON.parse(jobStr)
                await processJob(job)
            } else {
                await new Promise(resolve => setTimeout(resolve, 3000))
            }
        } catch (err) {
            console.error('❌ Lỗi vòng lặp chính:', err)
        }
    }
}

startWorker()

// Server để check health trên Cloud Run
const app = express()
const PORT = process.env.PORT || 8080
app.get('/', function (_req, res) {
    res.send('🟢 Worker đang hoạt động')
})
app.listen(PORT, () => {
    console.log(`🌐 Listening on port ${PORT}`)
})
