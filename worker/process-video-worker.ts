import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import fs from 'fs'
import os from 'os'
import path from 'path'
import express from 'express'
import axios from 'axios'
import { spawn } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'

// 🔐 Đọc secrets từ CSI mount
const readSecret = (key: string) => {
    try {
        return fs.readFileSync(`/mnt/secrets-store/${key}`, 'utf8').trim()
    } catch (e) {
        throw new Error(`❌ Lỗi đọc secret ${key}: ${e}`)
    }
}

const SUPABASE_URL = readSecret('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = readSecret('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_STORAGE_BUCKET = readSecret('SUPABASE_STORAGE_BUCKET')
const REDIS_HOST = readSecret('REDIS_HOST')
const REDIS_PORT = readSecret('REDIS_PORT')
const REDIS_PASSWORD = readSecret('REDIS_PASSWORD')
const PORT = readSecret('PORT') || '8080'

console.log('🔐 SUPABASE_SERVICE_ROLE_KEY bắt đầu bằng:', SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) + '...')
console.log('🔐 SUPABASE_URL:', SUPABASE_URL)

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

        console.log('🔗 FFmpeg merge CMD:', ['ffmpeg', ...args].join(' '))

        const proc = spawn('ffmpeg', args)
        const timeoutMs = targetDuration * 1.5 * 1000

        const timeout = setTimeout(() => {
            console.error('⏱ FFmpeg timeout – sẽ kill tiến trình.')
            proc.kill('SIGKILL')
            reject(new Error('FFmpeg merge timeout'))
        }, timeoutMs)

        proc.stderr.on('data', (data) => {
            console.error(`📄 FFmpeg stderr: ${data.toString()}`)
        })

        proc.stdout.on('data', (data) => {
            console.log(`📤 FFmpeg stdout: ${data.toString()}`)
        })

        proc.on('error', (err) => {
            clearTimeout(timeout)
            console.error('❌ FFmpeg không thể chạy:', err)
            reject(err)
        })

        proc.on('close', (code) => {
            clearTimeout(timeout)
            console.log(`📦 FFmpeg kết thúc với mã: ${code}`)
            if (code === 0) {
                console.log('✅ Merge thành công')
                resolve()
            } else {
                reject(new Error(`FFmpeg kết thúc với mã lỗi ${code}`))
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
                .on('start', (cmd) => console.log('🔇 Tách audio khỏi video:', cmd))
                .on('progress', (p) => console.log(`📶 Tách audio: ${p.percent?.toFixed(2)}%`))
                .on('stderr', (line) => console.log('📄 FFmpeg stderr:', line))
                .on('end', () => {
                    console.log('✅ Video sạch đã sẵn sàng')
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
        const targetDuration = Math.max(videoDur, audioDur)

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
        console.log(`📤 Upload kết quả lên Supabase: ${uploadPath}`)
        const fileBuffer = await fs.promises.readFile(outputFile)

        const uploadResult = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(uploadPath, fileBuffer, {
                contentType: 'video/mp4',
                upsert: true,
            })

        if (uploadResult.error) throw uploadResult.error
        console.log(`✅ Đã upload file merged lên Supabase: ${uploadPath}`)

        // ✅ Gửi job vào Redis để xoá sau 5 phút
        const deleteJob = {
            filePath: uploadPath,
            expiresAt: Date.now() + 5 * 60 * 1000 // sau 5 phút
        }
        await redis.lpush('delete-merged-jobs', JSON.stringify(deleteJob))
        console.log(`🕓 Đã tạo job xoá sau 5 phút cho: ${uploadPath}`)

        const cleanup = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`,
        ])

        if (cleanup?.error) {
            console.error('❌ Xoá file nguyên liệu thất bại:', cleanup.error)
        } else if (cleanup?.data?.length === 0) {
            console.warn('⚠️ Supabase không xoá file nào — có thể file không tồn tại.')
        } else {
            console.log(`🧼 Đã xoá ${cleanup.data.length} file nguyên liệu gốc:`, cleanup.data)
        }

    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true })
        console.log('🧹 Đã dọn thư mục RAM tạm:', tmp)
    }
}

const startWorker = async () => {
    console.log('🚀 Worker đã khởi động...')
    while (true) {
        try {
            const jobRaw = await redis.rpop('video-process-jobs')
            if (jobRaw) {
                const job = JSON.parse(jobRaw)
                console.log('📦 Job nhận từ Redis:', job)
                await processJob(job)
            } else {
                await delay(2000)
            }
        } catch (err) {
            console.error('❌ Lỗi trong worker loop:', err)
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
