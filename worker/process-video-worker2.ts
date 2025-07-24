import Redis from 'ioredis'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express from 'express'
import axios from 'axios'
import { spawn } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// ✅ Đọc từ process.env
const R2_BUCKET = process.env.R2_BUCKET_NAME!
const R2_ENDPOINT = process.env.R2_ENDPOINT!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!  // 👈 thêm dòng này
const REDIS_HOST = process.env.REDIS_HOST!
const REDIS_PORT = parseInt(process.env.REDIS_PORT!)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD!
const PORT = parseInt(process.env.PORT || '8080')

const r2Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: (times) => Math.min(times * 200, 2000),
})

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

const downloadFile = async (url: string, filePath: string): Promise<void> => {
    const writer = fs.createWriteStream(filePath)
    const response = await axios.get(url, { responseType: 'stream', timeout: 300_000 })
    response.data.pipe(writer)
    await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err)
            else resolve(metadata.format.duration ?? 0)
        })
    })
}

const mergeMedia = (
    video: string,
    audio: string,
    output: string,
    loopTarget: 'audio' | 'video' | 'none',
    loopCount: number,
    targetDuration: number
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const args: string[] = []

        if (loopTarget === 'audio') {
            args.push('-stream_loop', `${loopCount}`, '-i', audio, '-i', video)
        } else if (loopTarget === 'video') {
            args.push('-stream_loop', `${loopCount}`, '-i', video, '-i', audio)
        } else {
            args.push('-i', video, '-i', audio)
        }

        args.push(
            '-t', `${targetDuration.toFixed(2)}`,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-preset', 'veryfast',
            '-b:a', '128k',
            '-shortest',
            '-vsync', 'vfr',
            '-movflags', '+faststart',
            '-y',
            output
        )

        const proc = spawn('ffmpeg', args)
        const timeout = setTimeout(() => proc.kill('SIGKILL'), targetDuration * 1.5 * 1000)

        proc.stderr.on('data', (data) => console.error(`📄 FFmpeg stderr: ${data.toString()}`))
        proc.on('error', reject)
        proc.on('close', (code) => {
            clearTimeout(timeout)
            code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`))
        })
    })
}

const processJob = async (job: any) => {
    console.log('📦 Nhận job:', job.jobId)
    if (!job?.videoUrl || !job?.audioUrl || !job?.outputName) return

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `job-${job.jobId}-`))
    const inputVideo = path.join(tmp, 'video.mp4')
    const inputAudio = path.join(tmp, 'audio.mp3')
    const cleanVideo = path.join(tmp, 'clean.mp4')
    const outputFile = path.join(tmp, 'merged.mp4')

    try {
        // 🔁 Tái tạo public URL nếu cần (chắc ăn)
        const videoUrl = `${R2_PUBLIC_URL}/${job.videoUrl.split('/').pop()}`
        const audioUrl = `${R2_PUBLIC_URL}/${job.audioUrl.split('/').pop()}`

        await downloadFile(videoUrl, inputVideo)
        await downloadFile(audioUrl, inputAudio)

        await new Promise<void>((res, rej) => {
            ffmpeg()
                .input(inputVideo)
                .outputOptions(['-an', '-c:v', 'copy', '-y'])
                .output(cleanVideo)
                .on('end', () => res())
                .on('error', rej)
                .run()
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)
        const targetDuration = Math.max(videoDur, audioDur)

        let loopTarget: 'audio' | 'video' | 'none' = 'none'
        let loopCount = 0
        if (Math.abs(videoDur - audioDur) < 1) loopTarget = 'none'
        else if (videoDur > audioDur) { loopTarget = 'audio'; loopCount = Math.ceil(videoDur / audioDur) }
        else { loopTarget = 'video'; loopCount = Math.ceil(audioDur / videoDur) }

        await mergeMedia(cleanVideo, inputAudio, outputFile, loopTarget, loopCount, targetDuration)

        const fileBuffer = await fs.promises.readFile(outputFile)
        const r2Key = `outputs/${job.outputName}`
        await r2Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: r2Key,
            Body: fileBuffer,
            ContentType: 'video/mp4',
        }))
        console.log(`✅ Đã upload file kết quả lên R2: ${r2Key}`)

        await redis.zadd('delete-jobs', Date.now() + 5 * 60 * 1000, r2Key)
        console.log(`🕓 Đã tạo job xoá sau 5 phút cho: ${r2Key}`)

    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true })
    }
}

const startWorker = async () => {
    console.log('🚀 Worker đang chạy...')
    while (true) {
        try {
            const raw = await redis.rpop('process-jobs')
            if (raw) {
                const job = JSON.parse(raw)
                await processJob(job)
            } else {
                await delay(2000)
            }
        } catch (err) {
            console.error('❌ Lỗi worker:', err)
        }
    }
}
startWorker()

const app = express()
app.use(express.json())
app.get('/', (_req, res) => res.send('🟢 process-video-worker2 đang chạy'))
app.listen(PORT, () => {
    console.log(`🌐 Server listening on port ${PORT}`)
})
