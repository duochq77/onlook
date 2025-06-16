import express, { Request, Response } from 'express'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { Readable } from 'stream'

const app = express()
app.use(express.json())

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET
const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

console.log('📡 SUPABASE_URL:', supabaseUrl)
console.log('🔑 SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceRole)
console.log('📦 SUPABASE_STORAGE_BUCKET:', supabaseStorageBucket)
console.log('🔐 Redis URL:', redisUrl)
console.log('🔐 Redis Token:', !!redisToken)

if (!supabaseUrl || !supabaseServiceRole || !supabaseStorageBucket) {
    throw new Error(`❌ ENV Supabase thiếu:
    - SUPABASE_URL = ${supabaseUrl}
    - SUPABASE_SERVICE_ROLE_KEY = ${supabaseServiceRole}
    - SUPABASE_STORAGE_BUCKET = ${supabaseStorageBucket}`)
}
if (!redisUrl || !redisToken) {
    throw new Error(`❌ ENV Redis thiếu:
    - UPSTASH_REDIS_REST_URL = ${redisUrl}
    - UPSTASH_REDIS_REST_TOKEN = ${redisToken}`)
}

const redis = new Redis({ url: redisUrl, token: redisToken })
const supabase = createClient(supabaseUrl, supabaseServiceRole)

const TMP = '/tmp'
const QUEUE_KEY = 'onlook:job-queue'

async function download(url: string, dest: string) {
    const res = await fetch(url)
    console.log(`🌐 Tải: ${url} → status: ${res.status}`)
    if (!res.ok || !res.body) throw new Error(`❌ Không tải được file: ${url}`)

    const fileStream = fs.createWriteStream(dest)
    const nodeStream = Readable.from(res.body as any)

    await new Promise<void>((resolve, reject) => {
        nodeStream.pipe(fileStream)
        nodeStream.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

function checkFileSize(filePath: string) {
    try {
        return fs.statSync(filePath).size > 0
    } catch {
        return false
    }
}

function extractPath(url: string) {
    const parts = url.split(`/storage/v1/object/public/${supabaseStorageBucket}/`)
    return parts[1] || ''
}

async function processJob(job: any) {
    console.log('📌 Xử lý job:', job.jobId)

    const basePath = path.join(TMP, job.jobId)
    fs.mkdirSync(basePath, { recursive: true })

    const inputVideo = path.join(basePath, 'input.mp4')
    const inputAudio = path.join(basePath, 'input.mp3')
    const cleanVideo = path.join(basePath, 'clean.mp4')
    const outputFile = path.join(basePath, job.outputName)

    try {
        console.log('📥 Tải file...')
        await download(job.videoUrl, inputVideo)
        await download(job.audioUrl, inputAudio)

        if (!checkFileSize(inputVideo) || !checkFileSize(inputAudio)) {
            throw new Error('❌ File tải về dung lượng 0')
        }

        console.log('✂️ Tách audio gốc...')
        execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)

        console.log('🎧 Ghép audio mới...')
        execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`)

        console.log('📤 Upload kết quả...')
        const { error } = await supabase.storage
            .from(supabaseStorageBucket!) // ✅ dùng `!` để TypeScript không lỗi
            .upload(`${job.jobId}/outputs/${job.outputName}`, fs.createReadStream(outputFile), {
                contentType: 'video/mp4',
                upsert: true,
            })
        if (error) throw new Error('Lỗi upload: ' + error.message)

        console.log('🧹 Dọn file local...')
        fs.rmSync(basePath, { recursive: true, force: true })

        console.log('🧼 Xoá file gốc Supabase...')
        const vPath = extractPath(job.videoUrl)
        const aPath = extractPath(job.audioUrl)
        if (vPath) await supabase.storage.from(supabaseStorageBucket!).remove([vPath])
        if (aPath) await supabase.storage.from(supabaseStorageBucket!).remove([aPath])

        console.log(`✅ Xong job ${job.jobId}`)
    } catch (err) {
        console.error(`❌ Lỗi job ${job.jobId}:`, err)
    }
}

async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy, chờ job...')
    while (true) {
        try {
            const jobStr = await redis.rpop(QUEUE_KEY)
            if (!jobStr) {
                await new Promise((r) => setTimeout(r, 1000))
                continue
            }

            const job = typeof jobStr === 'string' ? JSON.parse(jobStr) : jobStr
            await processJob(job)
        } catch (err) {
            console.error('❌ Lỗi worker:', err)
            await new Promise((r) => setTimeout(r, 1000))
        }
    }
}

app.get('/', (_: Request, res: Response) => {
    res.send('✅ Worker is alive')
})

app.post('/', (_: Request, res: Response) => {
    console.log('⚡ Nhận POST từ Cloud Run (kiểm tra sống)')
    res.json({ message: 'Worker OK, đang chạy job loop...' })
})

const PORT = parseInt(process.env.PORT || '8080', 10)
app.listen(PORT, () => {
    console.log(`🚀 Worker lắng nghe tại cổng ${PORT}`)
    runWorker()
})
