// worker/merge-video-worker.ts

import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'

console.log('🔀 Merge Worker đã khởi động...')
console.log('🌐 SUPABASE_URL =', process.env.SUPABASE_URL)

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runMergeWorker() {
    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:merge')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const jobData = JSON.parse(job)
            const { cleanVideo, inputAudio, outputName, inputVideo } = jobData

            const videoPath = path.join('/tmp', cleanVideo)
            const audioPath = path.join('/tmp', 'audio.mp3')
            const outputPath = path.join('/tmp', outputName)

            const result = supabase.storage.from('stream-files').getPublicUrl(inputAudio)
            const publicAudioUrl = result.data.publicUrl
            if (!publicAudioUrl) throw new Error('❌ Không lấy được publicUrl audio')

            console.log('⏬ Tải audio từ:', publicAudioUrl)
            await downloadFile(publicAudioUrl, audioPath)

            const command = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c copy -shortest "${outputPath}"`
            console.log('🎬 Chạy FFmpeg:', command)
            await execPromise(command)

            console.log(`✅ Ghép video + audio thành công: ${outputName}`)

            // Đưa vào hàng upload
            await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName }))

            // Đưa vào hàng cleanup tạm
            await redis.rpush('ffmpeg-jobs:cleanup', JSON.stringify({
                deleteType: 'origin',
                originFiles: [inputVideo, inputAudio, cleanVideo]
            }))

        } catch (err) {
            console.error('❌ Lỗi khi xử lý job merge:', err)
        }
    }
}

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        const file = fs.createWriteStream(dest)

        const request = https.get(url, (response) => {
            if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`))

            response.pipe(file)

            file.on('finish', () => {
                file.close(() => {
                    const size = fs.statSync(dest).size
                    if (size < 1000) {
                        reject(new Error(`⚠️ File audio quá nhỏ (${size} bytes)`))
                    } else {
                        resolve()
                    }
                })
            })

            file.on('error', reject)
        })

        request.setTimeout(15000, () => {
            request.abort()
            reject(new Error('⏰ Timeout tải audio'))
        })

        request.on('error', reject)
    })
}

function execPromise(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err) => {
            if (err) reject(err)
            else resolve()
        })
    })
}

// ✅ Giữ tiến trình sống bằng HTTP server
const PORT = parseInt(process.env.PORT || '8080', 10)
http.createServer((req, res) => {
    res.writeHead(200)
    res.end('✅ merge-video-worker is alive')
}).listen(PORT, () => {
    console.log(`🚀 HTTP server đang lắng nghe tại cổng ${PORT}`)
})

// ⏳ Khởi động vòng lặp chính
runMergeWorker()
