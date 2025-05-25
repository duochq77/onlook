// worker/cleanup-worker.ts

import 'dotenv/config'
import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import http from 'http'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

async function runCleanupWorker() {
    console.log('🧹 Cleanup Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:cleanup')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const {
                deleteType,
                originFiles // danh sách: [inputVideo, inputAudio, cleanVideo]
            } = JSON.parse(job)

            if (deleteType !== 'origin') {
                console.warn('⚠️ Bỏ qua job không phải dạng origin:', deleteType)
                continue
            }

            if (!Array.isArray(originFiles)) {
                console.warn('⚠️ originFiles không hợp lệ:', originFiles)
                continue
            }

            for (const f of originFiles) {
                const filePath = path.join('/tmp', f)
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath)
                    console.log(`✅ Đã xoá file tạm: ${filePath}`)
                } else {
                    console.warn(`⚠️ File không tồn tại: ${filePath}`)
                }
            }

            // ✅ Giải phóng bộ nhớ ngay sau khi xoá
            if (global.gc) {
                global.gc()
                console.log('🧠 Đã gọi garbage collector thủ công (global.gc())')
            } else {
                console.warn('⚠️ Node không chạy với --expose-gc nên không gọi được global.gc()')
            }

        } catch (err) {
            console.error('❌ Lỗi trong cleanup-worker:', err)
        }
    }
}

// ✅ Dummy HTTP server giữ tiến trình sống trên Cloud Run
const PORT = parseInt(process.env.PORT || '8080', 10)
http.createServer((req, res) => {
    res.writeHead(200)
    res.end('✅ cleanup-worker is alive')
}).listen(PORT, () => {
    console.log(`🚀 HTTP server lắng nghe tại cổng ${PORT}`)
})

// ⏳ Khởi động
runCleanupWorker()
