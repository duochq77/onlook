import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import http from 'http'

console.log('☁️ Upload Worker đã khởi động...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runUploadWorker() {
    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:upload')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const { outputName } = JSON.parse(job)
            const filePath = path.join('/tmp', outputName)

            console.log(`📤 Đang upload: ${outputName}`)

            if (!fs.existsSync(filePath)) {
                console.error(`❌ File không tồn tại: ${filePath}`)
                continue
            }

            const fileBuffer = fs.readFileSync(filePath)
            const { data, error } = await supabase.storage
                .from('stream-files')
                .upload(`outputs/${outputName}`, fileBuffer, {
                    contentType: 'video/mp4',
                    upsert: true
                })

            if (error) throw error
            console.log('✅ Upload thành công:', data?.path)

            fs.unlinkSync(filePath)
            console.log(`🧹 Đã xoá file output khỏi RAM: ${filePath}`)
        } catch (err) {
            console.error('❌ Lỗi upload:', err)
        }
    }
}

// ✅ HTTP giữ Cloud Run sống
const port = parseInt(process.env.PORT || '8080', 10)
http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ upload-video-worker is alive')
}).listen(port, () => {
    console.log(`🚀 Dummy server is listening on port ${port}`)
})

// 🚀 Start worker
runUploadWorker()
