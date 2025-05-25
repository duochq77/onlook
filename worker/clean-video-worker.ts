import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'

console.log('✂️ Clean Video Worker starting...')
console.log('🔧 ENV.SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('🔧 ENV.UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL)

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runCleanVideoWorker() {
    console.log('✅ Clean Video Worker is running...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:clean')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const jobData = typeof job === 'string' ? JSON.parse(job) : job
            console.log('📥 Job raw from Redis:', jobData)

            const { inputVideo, outputName, inputAudio } = jobData

            // ✅ Chuẩn hóa cho bucket mới
            const filePath = inputVideo.replace(/^stream-files\//, '')
            const result = supabase.storage.from('stream-files').getPublicUrl(filePath)
            const publicUrl = result.data.publicUrl
            if (!publicUrl) throw new Error('❌ Không lấy được publicUrl video')

            const inputPath = path.join('/tmp', inputVideo)
            const cleanOutput = path.join('/tmp', outputName)

            console.time('⏳ Tải video')
            await downloadFile(publicUrl, inputPath)
            console.timeEnd('⏳ Tải video')

            const command = `ffmpeg -y -i "${inputPath}" -c copy -an "${cleanOutput}"`
            console.log('🎬 Chạy FFmpeg:', command)

            console.time('🎬 FFmpeg xử lý')
            await execPromise(command)
            console.timeEnd('🎬 FFmpeg xử lý')

            console.log(`✅ Đã tạo video sạch: ${outputName}`)

            await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({
                cleanVideo: outputName,
                inputAudio,
                outputName
            }))
        } catch (err) {
            console.error('❌ Lỗi clean video:', err)
        }
    }
}

// ✅ Giữ Cloud Run sống
const PORT = process.env.PORT || 8080
http.createServer((req, res) => {
    res.writeHead(200)
    res.end('✅ Clean-video-worker is alive')
}).listen(PORT, () => {
    console.log(`🚀 HTTP server lắng nghe tại cổng ${PORT}`)
})

// ⏳ Bắt đầu vòng lặp
runCleanVideoWorker()

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        const file = fs.createWriteStream(dest)

        const request = https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`HTTP ${response.statusCode}: ${url}`))
            }

            response.pipe(file)

            file.on('finish', () => {
                file.close(() => {
                    const size = fs.statSync(dest).size
                    if (size < 1000) {
                        reject(new Error(`⚠️ File tải về quá nhỏ (${size} bytes)`))
                    } else {
                        resolve()
                    }
                })
            })

            file.on('error', reject)
        })

        request.setTimeout(15000, () => {
            request.abort()
            reject(new Error('⏰ Timeout tải file quá 15s'))
        })

        request.on('error', reject)
    })
}

function execPromise(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}
