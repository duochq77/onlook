import http from 'http'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { Readable } from 'stream'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TMP = '/tmp'
const QUEUE_KEY = 'onlook:job-queue'

// Tải file từ url về đường dẫn dest
async function download(url: string, dest: string) {
    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error(`❌ Không tải được file: ${url}`)

    const fileStream = fs.createWriteStream(dest)
    const nodeStream = Readable.from(res.body as any)

    await new Promise<void>((resolve, reject) => {
        nodeStream.pipe(fileStream)
        nodeStream.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

// Kiểm tra file có dung lượng > 0
const checkFileSize = (filePath: string) => {
    try {
        const stats = fs.statSync(filePath)
        return stats.size > 0
    } catch {
        return false
    }
}

// Lấy path file gốc trong Supabase từ url
const extractPath = (url: string) => {
    try {
        const parts = url.split(`/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/`)
        if (parts.length === 2) return parts[1]
        return ''
    } catch {
        return ''
    }
}

// Xử lý job
async function processJob(job: any) {
    console.log('📌 Xử lý job:', job.jobId)

    // Dùng jobId làm folder base lưu file tạm
    const basePath = path.join(TMP, job.jobId)
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true })

    const inputVideo = path.join(basePath, 'input.mp4')
    const inputAudio = path.join(basePath, 'input.mp3')
    const cleanVideo = path.join(basePath, 'clean.mp4')
    const outputFile = path.join(basePath, job.outputName)

    try {
        console.log('📥 Tải video + audio từ Supabase...')
        await download(job.videoUrl, inputVideo)
        await download(job.audioUrl, inputAudio)

        if (!fs.existsSync(inputVideo) || !fs.existsSync(inputAudio)) throw new Error('File tải về không tồn tại')
        if (!checkFileSize(inputVideo) || !checkFileSize(inputAudio)) throw new Error('File tải về dung lượng 0')

        console.log('✂️ Tách audio khỏi video...')
        execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)

        console.log('🎧 Ghép audio gốc vào video sạch...')
        execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`)

        console.log('📤 Upload file kết quả lên Supabase...')
        const { error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(`${job.jobId}/outputs/${job.outputName}`, fs.createReadStream(outputFile), {
                contentType: 'video/mp4',
                upsert: true,
            })

        if (error) throw new Error('Lỗi upload file hoàn chỉnh: ' + error.message)

        console.log('✅ Upload thành công')

        // Xóa file tạm
        for (const f of [inputVideo, inputAudio, cleanVideo, outputFile]) {
            try {
                if (fs.existsSync(f)) fs.unlinkSync(f)
            } catch { }
        }

        // Xóa file gốc
        const videoPath = extractPath(job.videoUrl)
        const audioPath = extractPath(job.audioUrl)
        if (videoPath) {
            try {
                await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove([videoPath])
            } catch { }
        }
        if (audioPath) {
            try {
                await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove([audioPath])
            } catch { }
        }

        console.log(`✅ Hoàn thành job ${job.jobId}`)

    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
    }
}

async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy, chờ job...')

    while (true) {
        try {
            // Lấy job từ queue, chờ tối đa 10s nếu queue rỗng
            const jobJson = await redis.brpop(QUEUE_KEY, 10)
            if (!jobJson) {
                // Queue rỗng, tiếp tục lặp
                continue
            }
            const [, jobStr] = jobJson
            const job = JSON.parse(jobStr)
            await processJob(job)
        } catch (error) {
            console.error('❌ Lỗi worker khi lấy hoặc xử lý job:', error)
        }
    }
}

// Tạo HTTP server để Cloud Run giữ Worker sống
import http from 'http'
const port = process.env.PORT || 8080
const server = http.createServer((req, res) => {
    res.writeHead(200)
    res.end('Worker is alive')
})
server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`)
    runWorker()
})
