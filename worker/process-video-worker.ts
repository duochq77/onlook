import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import os from 'os'
import express from 'express'
import fetch from 'node-fetch'

const app = express()
app.use(express.json())
const PORT = process.env.PORT || 8080

// 🔐 Kiểm tra biến môi trường
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET as string // ✅ ép kiểu để tránh lỗi build
const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

// 🪵 Log biến môi trường
console.log('📥 SUPABASE_URL:', supabaseUrl)
console.log('📥 SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceRoleKey)
console.log('📥 SUPABASE_STORAGE_BUCKET:', supabaseStorageBucket)
console.log('📥 UPSTASH_REDIS_REST_URL:', redisUrl)
console.log('📥 UPSTASH_REDIS_REST_TOKEN:', !!redisToken)

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseStorageBucket || !redisUrl || !redisToken) {
    console.error('❌ Thiếu biến môi trường bắt buộc.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const redis = new Redis({ url: redisUrl, token: redisToken })

interface JobPayload {
    jobId: string
    videoUrl: string
    audioUrl: string
    outputName: string
}

async function downloadFile(url: string, dest: string): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Tải file lỗi: ${url}`)
    const fileStream = fs.createWriteStream(dest)
    await new Promise<void>((resolve, reject) => {
        if (!res.body) return reject(new Error('❌ Không có body khi tải file.'))
        res.body.pipe(fileStream)
        res.body.on('error', reject)
        fileStream.on('finish', () => resolve())
    })
}

async function processJob(job: JobPayload) {
    if (!job?.jobId || !job?.videoUrl || !job?.audioUrl || !job?.outputName) {
        throw new Error(`❌ Job không hợp lệ: ${JSON.stringify(job)}`)
    }

    console.log(`📌 Xử lý job: ${job.jobId}`)

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-'))
    const videoPath = path.join(tmpDir, 'input.mp4')
    const audioPath = path.join(tmpDir, 'input.mp3')
    const outputPath = path.join(tmpDir, job.outputName)

    console.log('📥 Tải file...')
    await downloadFile(job.videoUrl, videoPath)
    await downloadFile(job.audioUrl, audioPath)

    console.log('🎬 Ghép audio...')
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions('-c:v copy', '-c:a aac', '-shortest')
            .on('end', resolve)
            .on('error', reject)
            .save(outputPath)
    })

    if (!fs.existsSync(outputPath)) throw new Error('❌ Ghép audio thất bại: Không có file output.')

    console.log('📤 Upload kết quả...')
    const filePath = `outputs/${job.outputName}`
    const buffer = fs.readFileSync(outputPath)

    const { error: uploadError } = await supabase.storage
        .from(supabaseStorageBucket)
        .upload(filePath, buffer, {
            contentType: 'video/mp4',
            upsert: true,
        })

    if (uploadError) throw new Error('Lỗi upload: ' + uploadError.message)

    // ✅ Đặt quyền public cho file
    console.log('🌐 Đặt quyền public cho file...')
    const { data: publicData, error: publicError } = await supabase
        .storage
        .from(supabaseStorageBucket)
        .getPublicUrl(filePath)

    if (publicError) throw new Error('Lỗi đặt quyền public: ' + publicError.message)
    console.log('✅ Public URL:', publicData.publicUrl)

    // 🧹 Dọn dẹp file gốc trên Supabase
    console.log('🧹 Dọn dẹp file gốc trên Supabase...')
    const videoKey = `input-videos/input-${job.jobId}.mp4`
    const audioKey = `input-audios/input-${job.jobId}.mp3`
    await supabase.storage.from(supabaseStorageBucket).remove([videoKey, audioKey])

    // 🧹 Dọn local
    fs.rmSync(tmpDir, { recursive: true, force: true })
    console.log(`✅ Hoàn tất job ${job.jobId}`)
}

app.post('/', async (req, res) => {
    console.log('⚡ Nhận POST từ Cloud Run')
    console.log('📦 Payload nhận được:', req.body)

    res.status(200).json({ ok: true })

    try {
        const job: JobPayload = req.body
        await processJob(job)
    } catch (err: any) {
        console.error(`❌ Lỗi job ${req.body?.jobId || 'unknown'}:`, err)
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Worker lắng nghe tại cổng ${PORT}`)
    console.log('⏳ Worker Onlook đang chạy, chờ job...')
})
