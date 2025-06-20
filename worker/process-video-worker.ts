import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express, { Request, Response, Express } from 'express'
import fetch from 'node-fetch'

console.log('🚀 process-video-worker.ts khởi động...')

// Biến môi trường
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    PORT = 8080
} = process.env

if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !SUPABASE_STORAGE_BUCKET ||
    !REDIS_HOST ||
    !REDIS_PORT ||
    !REDIS_PASSWORD
) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.')
}

// Khởi tạo Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Khởi tạo Redis client với cấu hình retry, timeout, bắt lỗi
const redis = new Redis({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {}, // Bắt buộc cho Upstash TCP
    connectTimeout: 10000,
    maxRetriesPerRequest: 5,
    retryStrategy(times) {
        const delay = Math.min(times * 1000, 30000) // tăng dần 1s, max 30s
        console.warn(`Redis retry #${times}, chờ ${delay}ms`)
        return delay
    }
})

redis.on('error', (err) => {
    console.error('Redis error:', err)
})

redis.on('close', () => {
    console.warn('Redis connection closed, đang cố kết nối lại...')
})

// Hàm tải file về RAM (Buffer)
const downloadFileToBuffer = async (url: string): Promise<Buffer> => {
    console.log(`▶️ Bắt đầu tải file từ URL về RAM: ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`❌ Không tải được file: ${url}, status: ${res.status}`)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`✔️ Đã tải file về RAM: ${url}, kích thước: ${buffer.length} bytes`)
    return buffer
}

// Hàm ghi Buffer ra file tạm
const saveBufferToFile = async (buffer: Buffer, filePath: string) => {
    await fs.promises.writeFile(filePath, buffer)
    console.log(`✔️ Đã ghi buffer ra file: ${filePath}`)
}

// Hàm lấy thời lượng media
const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error(`❌ Lỗi lấy duration file: ${filePath}`, err)
                return reject(err)
            }
            const duration = metadata.format.duration || 0
            console.log(`⏱ Duration của file ${filePath}: ${duration}s`)
            resolve(duration)
        })
    })
}

// Hàm lặp media để đồng bộ thời lượng
const loopMedia = (input: string, output: string, duration: number) => {
    console.log(`▶️ Lặp media file ${input} cho đủ thời lượng ${duration}s vào ${output}`)
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(input)
            .inputOptions('-stream_loop', '-1')
            .outputOptions('-t', `${duration}`)
            .save(output)
            .on('end', () => {
                console.log(`✔️ Lặp media xong: ${output}`)
                resolve()
            })
            .on('error', (err) => {
                console.error(`❌ Lỗi khi lặp media: ${err.message}`)
                reject(err)
            })
    })
}

// Hàm cắt media
const cutMedia = (input: string, output: string, duration: number) => {
    console.log(`▶️ Cắt media file ${input} còn ${duration}s, lưu vào ${output}`)
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(input)
            .setDuration(duration)
            .save(output)
            .on('end', () => {
                console.log(`✔️ Cắt media xong: ${output}`)
                resolve()
            })
            .on('error', (err) => {
                console.error(`❌ Lỗi khi cắt media: ${err.message}`)
                reject(err)
            })
    })
}

// Xử lý job: tải file, tách audio, đồng bộ, ghép, upload kết quả
const processJob = async (job: any) => {
    console.log(`📦 Bắt đầu xử lý job ${job.jobId}`)

    const tmpDir = path.join(os.tmpdir(), `onlook-${job.jobId}`)
    try {
        // Xóa thư mục tạm nếu có, rồi tạo lại mới
        fs.rmSync(tmpDir, { recursive: true, force: true })
        fs.mkdirSync(tmpDir)
        console.log(`✔️ Thư mục tạm ${tmpDir} đã được tạo mới`)
    } catch (err) {
        console.error(`❌ Lỗi khi tạo thư mục tạm ${tmpDir}:`, err)
        throw err
    }

    const inputVideo = path.join(tmpDir, 'input.mp4')
    const inputAudio = path.join(tmpDir, 'input.mp3')
    const cleanVideo = path.join(tmpDir, 'clean.mp4')
    const finalVideo = path.join(tmpDir, 'final.mp4')
    const finalAudio = path.join(tmpDir, 'final.mp3')
    const mergedOutput = path.join(tmpDir, 'output.mp4')

    try {
        // Tải file video + audio về RAM rồi ghi ra file tạm
        const videoBuffer = await downloadFileToBuffer(job.videoUrl)
        await saveBufferToFile(videoBuffer, inputVideo)

        const audioBuffer = await downloadFileToBuffer(job.audioUrl)
        await saveBufferToFile(audioBuffer, inputAudio)

        console.log('▶️ Bắt đầu tách video sạch (no audio, copy video stream)...')
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(inputVideo)
                .outputOptions('-c:v copy', '-an') // copy video, remove audio
                .save(cleanVideo)
                .on('end', () => {
                    console.log(`✔️ Đã tách video sạch: ${cleanVideo}`)
                    resolve()
                })
                .on('error', (err) => {
                    console.error(`❌ Lỗi khi tách video sạch: ${err.message}`)
                    reject(err)
                })
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)
        console.log(`⏱ Thời lượng video: ${videoDur}s, audio: ${audioDur}s`)

        // Đồng bộ thời lượng video và audio
        if (Math.abs(videoDur - audioDur) < 1) {
            console.log('▶️ Thời lượng gần bằng, sao chép trực tiếp')
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

        console.log('▶️ Bắt đầu ghép video và audio (copy video stream, mã hoá lại audio AAC)...')
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(finalVideo)
                .input(finalAudio)
                .outputOptions('-c:v copy', '-c:a aac', '-shortest')
                .save(mergedOutput)
                .on('end', () => {
                    console.log(`✔️ Ghép video + audio xong: ${mergedOutput}`)
                    resolve()
                })
                .on('error', (err) => {
                    console.error(`❌ Lỗi khi ghép media: ${err.message}`)
                    reject(err)
                })
        })

        const buffer = fs.readFileSync(mergedOutput)
        const outputPath = `outputs/${job.outputName}`
        console.log(`▶️ Upload file kết quả lên Supabase: ${outputPath}`)
        const { error: uploadErr } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(outputPath, buffer, {
            upsert: true,
            contentType: 'video/mp4'
        })
        if (uploadErr) {
            throw new Error(`❌ Upload file lỗi: ${uploadErr.message}`)
        }
        console.log('✔️ Upload thành công')

        console.log('▶️ Xoá file nguyên liệu trên Supabase')
        const { error: removeErr } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`
        ])
        if (removeErr) {
            console.warn(`⚠️ Lỗi khi xóa file nguyên liệu: ${removeErr.message}`)
        } else {
            console.log('✔️ Xoá file nguyên liệu thành công')
        }
    } catch (err: any) {
        console.error(`❌ Lỗi job ${job.jobId}:`, err.message || err)
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
            console.log(`🧽 Dọn RAM job ${job.jobId} thành công`)
        } catch (err) {
            console.warn(`⚠️ Lỗi khi dọn RAM job ${job.jobId}:`, err)
        }
    }
}

// Vòng lặp worker rút job liên tục từ Redis queue
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

// Express server cho health check + POST / tránh lỗi 404
const app: Express = express()
app.use(express.json())

app.post('/', (req: Request, res: Response) => {
    res.status(200).send('OK - Worker nhận POST /')
})

app.get('/', (req: Request, res: Response) => {
    res.send('🟢 Worker hoạt động')
})

app.listen(Number(PORT), () => {
    console.log(`🌐 Listening on port ${PORT}`)
})

// Khởi chạy worker
startWorker()
