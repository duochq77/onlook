import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import http from 'http'

console.log('🧹 Cleanup Worker khởi động...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runCleanupWorker() {
    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:cleanup')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const { deleteType, originFiles } = JSON.parse(job)

            if (deleteType !== 'origin') {
                console.warn('⚠️ Bỏ qua job cleanup không hợp lệ:', deleteType)
                continue
            }

            if (!Array.isArray(originFiles)) {
                console.warn('⚠️ originFiles không phải mảng:', originFiles)
                continue
            }

            for (const file of originFiles) {
                if (file.startsWith('input/')) {
                    // ✅ Là file gốc trên Supabase → xoá khỏi bucket stream-files
                    const { error } = await supabase.storage.from('stream-files').remove([file])
                    if (error) {
                        console.error(`❌ Lỗi xoá Supabase: ${file}`, error.message)
                    } else {
                        console.log(`🗑️ Đã xoá khỏi Supabase: ${file}`)
                    }
                } else {
                    // ✅ Là file RAM → xoá khỏi /tmp
                    const tmpPath = path.join('/tmp', file)
                    if (fs.existsSync(tmpPath)) {
                        fs.unlinkSync(tmpPath)
                        console.log(`🧹 Đã xoá file RAM: ${tmpPath}`)
                    } else {
                        console.warn(`⚠️ File RAM không tồn tại: ${tmpPath}`)
                    }
                }
            }

        } catch (err) {
            console.error('❌ Lỗi trong cleanup-worker:', err)
        }
    }
}

// ✅ HTTP giữ Cloud Run sống
const PORT = parseInt(process.env.PORT || '8080', 10)
http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ cleanup-worker is alive')
}).listen(PORT, () => {
    console.log(`🚀 cleanup-worker lắng nghe tại cổng ${PORT}`)
})

// 🚀 Start loop
runCleanupWorker()
