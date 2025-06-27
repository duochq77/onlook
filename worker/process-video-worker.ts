import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express from 'express'
import axios from 'axios'
import { spawn } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'

// 🔐 Biến môi trường
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    PORT = '8080',
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET || !REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.')
}

// 🛠 Khởi tạo Supabase và Redis
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const redis = new Redis({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: (times) => Math.min(times * 200, 2000),
})

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

const downloadFile = async (url: string, filePath: string): Promise<void> => {
    const timeout = 300000
    const writer = fs.createWriteStream(filePath)
    console.log(`📥 Bắt đầu tải file từ: ${url}`)
    const response = await axios.get(url, { responseType: 'stream', timeout })
    response.data.pipe(writer)
    await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
    const stats = await fs.promises.stat(filePath)
    console.log(`✅ Tải xong file (${stats.size} bytes): ${url}`)
}

const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err)
            else {
                console.log(`📊 Metadata của ${filePath}:`, metadata.format)
                resolve(metadata.format.duration ?? 0)
            }
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
            '-t', `${targetDuration}`,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-shortest',
            '-vsync', '2',
            '-y',
            output
        )

        console.log('🔗 FFmpeg merge CMD:', ['ffmpeg', ...args].join(' '))

        const proc = spawn('ffmpeg', args)

        proc.stdout.on('data', (data) => {
            console.log(`📤 FFmpeg stdout: ${data.toString()}`)
        })

        proc.stderr.on('data', (data) => {
            console.error(`📄 FFmpeg stderr: ${data.toString()}`)
        })

        proc.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Merge thành công')
                resolve()
            } else {
                reject(new Error(`ffmpeg exited with code ${code}`))
            }
        })
    })
}

const processJob = async (job: any) => {
    console.log('📦 Nhận job:', job.jobId)
    if (!job?.videoUrl || !job?.audioUrl) return console.error('❌ Thiếu URL video hoặc audio')

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `job-${job.jobId}-`))
    console.log(`📂 Tạo thư mục tạm: ${tmp}`)

    const inputVideo = path.join(tmp, 'video.mp4')
    const inputAudio = path.join(tmp, 'audio.mp3')
    const cleanVideo = path.join(tmp, 'clean.mp4')
    const outputFile = path.join(tmp, 'merged.mp4')

    try {
        await downloadFile(job.videoUrl, inputVideo)
        await downloadFile(job.audioUrl, inputAudio)

        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(inputVideo)
                .outputOptions(['-an', '-c:v', 'copy', '-y'])
                .output(cleanVideo)
                .on('start', (cmd) => console.log('🔇 FFmpeg remove audio:', cmd))
                .on('progress', (p) => console.log(`📶 Tiến trình tách audio: ${p.percent?.toFixed(2)}%`))
                .on('stderr', (line) => console.log('📄 FFmpeg stderr:', line))
                .on('end', () => {
                    console.log('✅ Đã tách video sạch')
                    resolve()
                })
                .on('error', reject)
                .run()
        })

        await delay(1000)
        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)
        console.log(`📏 Duration video: ${videoDur}s, audio: ${audioDur}s`)

        let loopTarget: 'audio' | 'video' | 'none' = 'none'
        let loopCount = 0
        let targetDuration = Math.max(videoDur, audioDur)

        if (Math.abs(videoDur - audioDur) < 1) {
            loopTarget = 'none'
        } else if (videoDur > audioDur) {
            loopTarget = 'audio'
            loopCount = Math.ceil(videoDur / audioDur)
        } else {
            loopTarget = 'video'
            loopCount = Math.ceil(audioDur / videoDur)
        }

        await mergeMedia(cleanVideo, inputAudio, outputFile, loopTarget, loopCount, targetDuration)

        const uploadPath = `outputs/${job.outputName}`
        console.log(`📤 Đang upload kết quả lên: ${uploadPath}`)
        const result = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(uploadPath, await fs.promises.readFile(outputFile), {
                contentType: 'video/mp4',
                upsert: true,
            })

        if (result.error) throw result.error
        console.log(`✅ Đã upload kết quả lên Supabase: ${uploadPath}`)

        const cleanup = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`,
        ])
        if (cleanup.error) console.warn('⚠️ Lỗi khi xoá file nguyên liệu:', cleanup.error)
        else console.log('🧼 Đã xoá 2 file nguyên liệu trên Supabase.')
    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true })
        console.log('🧹 Đã xoá thư mục RAM tạm:', tmp)
    }
}

const startWorker = async () => {
    console.log('🚀 Worker đã khởi động...')
    while (true) {
        try {
            const jobRaw = await redis.rpop('video-process-jobs')
            if (jobRaw) {
                const job = JSON.parse(jobRaw)
                await processJob(job)
            } else {
                await delay(2000)
            }
        } catch (err) {
            console.error('❌ Lỗi trong vòng lặp worker:', err)
        }
    }
}
startWorker()

const app = express()
app.use(express.json())
app.get('/', (_req, res) => res.send('🟢 process-video-worker hoạt động'))
app.post('/', (_req, res) => res.status(200).send('OK'))
app.listen(Number(PORT), () => {
    console.log(`🌐 Server lắng nghe tại PORT ${PORT}`)
})
