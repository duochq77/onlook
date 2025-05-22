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
            await new Promise((r) => setTimeout(r, 5000))
            continue
        }

        try {
            const {
                outputName,
                endedAt,
                deleteType, // 'origin' | 'final'
                originFiles, // mảng file gốc cần xoá (nếu có)
            } = JSON.parse(job)

            if (deleteType === 'origin') {
                // 🔹 TH1: Xoá file gốc/tạm ngay sau khi ghép xong
                if (Array.isArray(originFiles)) {
                    for (const f of originFiles) {
                        const filePath = path.join('/tmp', f)
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath)
                            console.log(`✅ Đã xoá file gốc/tạm: ${filePath}`)
                        } else {
                            console.log(`⚠️ File không tồn tại: ${filePath}`)
                        }
                    }
                }

                if (outputName) {
                    const outputPath = path.join('/tmp', outputName)
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath)
                        console.log(`✅ Đã xoá file output tạm: ${outputPath}`)
                    }
                }

            } else if (deleteType === 'final') {
                // 🔹 TH2: Xoá file livestream sau 5 phút kể từ khi seller kết thúc
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
                    await redis.rpush('ffmpeg-jobs:cleanup', job)
                    await new Promise((r) => setTimeout(r, 3000))
                    continue
                }

                const filePath = path.join('/tmp', outputName)
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath)
                    console.log(`✅ Đã xoá file livestream final: ${filePath}`)
                } else {
                    console.log(`⚠️ File final không tồn tại: ${filePath}`)
                }

            } else {
                console.warn(`⚠️ Không rõ loại deleteType: ${deleteType}`)
            }

        } catch (err) {
            console.error('❌ Lỗi xử lý cleanup job:', err)
        }
    }
}

runCleanupWorker()
