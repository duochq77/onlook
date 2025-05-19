import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'

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
            const {
                outputName,
                endedAt,
                deleteType, // 'origin' | 'final'
                originFiles // mảng file gốc cần xoá (nếu có)
            } = JSON.parse(job)

            if (deleteType === 'origin') {
                // Xoá file gốc + file tạm ngay lập tức
                if (Array.isArray(originFiles)) {
                    for (const f of originFiles) {
                        const filePath = path.join('/tmp', f)
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath)
                            console.log(`✅ Đã xoá file gốc/tạm: ${filePath}`)
                        } else {
                            console.log(`⚠️ File gốc/tạm không tồn tại: ${filePath}`)
                        }
                    }
                }
                // Xoá luôn file output nếu có
                if (outputName) {
                    const outputPath = path.join('/tmp', outputName)
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath)
                        console.log(`✅ Đã xoá file output: ${outputPath}`)
                    }
                }
            }
            else if (deleteType === 'final') {
                // Xoá file media đã hoàn chỉnh sau 5 phút kể từ endedAt
                if (!endedAt) {
                    console.warn('⚠️ Job xoá final thiếu endedAt, bỏ qua')
                    continue
                }

                const now = Date.now()
                const delayMs = now - endedAt
                const delayThreshold = 5 * 60 * 1000 // 5 phút

                if (delayMs < delayThreshold) {
                    const waitMs = delayThreshold - delayMs
                    console.log(`🕒 Chưa đủ 5 phút, chờ thêm ${Math.ceil(waitMs / 1000)} giây...`)
                    // Đẩy lại job để xử lý sau
                    await redis.rpush('ffmpeg-jobs:cleanup', job)
                    await new Promise((r) => setTimeout(r, 3000)) // nghỉ nhẹ
                    continue
                }

                const filePath = path.join('/tmp', outputName)
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath)
                    console.log(`✅ Đã xoá file media final: ${filePath}`)
                } else {
                    console.log(`⚠️ File media final không tồn tại: ${filePath}`)
                }
            }
            else {
                console.warn(`⚠️ Loại deleteType không xác định: ${deleteType}`)
            }
        } catch (err) {
            console.error('❌ Lỗi khi xử lý cleanup job:', err)
        }
    }
}

runCleanupWorker()
