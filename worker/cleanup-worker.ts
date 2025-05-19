import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'

// Khởi tạo Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function runCleanupWorker() {
    console.log('🧹 Cleanup Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:cleanup')
        if (!job) {
            await new Promise((r) => setTimeout(r, 5000)) // kiểm tra mỗi 5 giây
            continue
        }

        try {
            const { outputName, endedAt } = JSON.parse(job)

            const now = Date.now()
            const delayMs = now - endedAt
            const delayThreshold = 5 * 60 * 1000 // 5 phút

            if (delayMs < delayThreshold) {
                const waitMs = delayThreshold - delayMs
                console.log(`🕒 Chưa đủ 5 phút, chờ thêm ${Math.ceil(waitMs / 1000)} giây...`)
                // Đẩy lại job để xử lý sau
                await redis.rpush('ffmpeg-jobs:cleanup', JSON.stringify({ outputName, endedAt }))
                await new Promise((r) => setTimeout(r, 3000)) // nghỉ nhẹ
                continue
            }

            const filePath = path.join('/tmp', outputName)
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
                console.log(`✅ Đã xoá file: ${filePath}`)
            } else {
                console.log(`⚠️ File không tồn tại: ${filePath}`)
            }
        } catch (err) {
            console.error('❌ Lỗi khi xử lý cleanup job:', err)
        }
    }
}

runCleanupWorker()
