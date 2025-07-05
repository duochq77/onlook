import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import express from 'express'

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    PORT = '8080',
} = process.env

if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !SUPABASE_STORAGE_BUCKET ||
    !REDIS_HOST ||
    !REDIS_PORT ||
    !REDIS_PASSWORD
) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const redis = new Redis({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {}, // Bắt buộc để tránh lỗi ECONNRESET khi chạy trên GKE
    retryStrategy: (times) => Math.min(times * 200, 2000),
})

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

const processJob = async (jobRaw: string) => {
    try {
        const parsed = JSON.parse(jobRaw)
        const { filePath, expiresAt } = parsed

        if (!filePath || !expiresAt) {
            console.warn('⚠️ Job không hợp lệ, thiếu filePath hoặc expiresAt.')
            return
        }

        if (Date.now() < expiresAt) {
            // Chưa đến hạn xoá – đẩy lại cuối hàng đợi
            await redis.rpush('delete-merged-jobs', jobRaw)
            return
        }

        console.log(`🧽 Xoá file hết hạn: ${filePath}`)

        const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET!).remove([filePath])
        if (error) {
            console.error(`❌ Lỗi xoá file ${filePath}:`, error.message)
        } else {
            console.log(`✅ Đã xoá file hoàn chỉnh khỏi Supabase: ${filePath}`)
        }
    } catch (err) {
        console.error('❌ Lỗi xử lý job:', err)
    }
}

const startWorker = async () => {
    console.log('🧼 delete-merged-worker.ts khởi động...')

    while (true) {
        try {
            const jobRaw = await redis.lpop('delete-merged-jobs')
            if (jobRaw) {
                await processJob(jobRaw)
            } else {
                await delay(5000)
            }
        } catch (err) {
            console.error('❌ Lỗi trong vòng lặp worker:', err)
            await delay(5000)
        }
    }
}

startWorker().catch(console.error)

// Express server để kiểm tra trạng thái
const app = express()
app.get('/', (_req, res) => res.send('🟢 delete-merged-worker đang chạy'))
app.listen(Number(PORT), () => {
    console.log(`🌐 delete-merged-worker lắng nghe tại PORT ${PORT}`)
})
