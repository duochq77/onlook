// ✅ delete-merged-worker2 chuyển sang dùng Cloudflare R2 + Redis Cloud (GKE Standard)
// ❗ Không thay đổi logic xử lý dữ liệu

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import Redis from 'ioredis'
import fs from 'fs'
import express from 'express'

// ✅ Đọc biến môi trường
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const REDIS_HOST = process.env.REDIS_HOST!
const REDIS_PORT = parseInt(process.env.REDIS_PORT!)
const REDIS_USERNAME = process.env.REDIS_USERNAME!
const REDIS_PASSWORD = process.env.REDIS_PASSWORD!
const PORT = process.env.PORT || '8080'

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: (times) => Math.min(times * 200, 2000),
})

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

const processJob = async (jobRaw: string) => {
    try {
        const { filePath, expiresAt } = JSON.parse(jobRaw)
        if (!filePath || !expiresAt) {
            console.warn('⚠️ Job không hợp lệ:', jobRaw)
            return
        }

        const now = Date.now()
        if (now < expiresAt) {
            console.log(`⏳ Chưa đến hạn xoá file: ${filePath} (còn ${((expiresAt - now) / 1000).toFixed(0)}s)`)
            await redis.rpush('delete-merged-jobs', jobRaw)
            return
        }

        console.log(`🧽 Xoá file hết hạn: ${filePath}`)
        await r2.send(new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: filePath,
        }))

        console.log(`✅ Đã xoá file hoàn chỉnh khỏi R2: ${filePath}`)
    } catch (err) {
        console.error('❌ Lỗi xử lý job xoá file:', err)
    }
}

const startWorker = async () => {
    console.log('🧼 delete-merged-worker2 (R2 + Redis Cloud) khởi động...')

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

const app = express()
app.get('/', (_req, res) => res.send('🟢 delete-merged-worker2 (R2) đang chạy'))
app.listen(Number(PORT), () => {
    console.log(`🌐 delete-merged-worker2 (R2) lắng nghe tại PORT ${PORT}`)
})
