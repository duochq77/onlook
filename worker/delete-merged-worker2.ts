import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

const redis = new Redis({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!),
    password: process.env.REDIS_PASSWORD!,
    tls: {}, // Upstash TCP yêu cầu TLS
})

const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const ZSET_KEY = 'delete-jobs'

async function deleteFileFromR2(key: string) {
    const cmd = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    })

    await s3.send(cmd)
    console.log(`🗑️ Đã xoá file khỏi R2: ${key}`)
}

async function startWorker() {
    console.log('🔁 Bắt đầu xoá file đúng hạn từ Redis...')

    while (true) {
        try {
            const now = Date.now()
            const jobs = await redis.zrangebyscore(ZSET_KEY, 0, now, 'LIMIT', 0, 10)

            if (jobs.length === 0) {
                await new Promise((r) => setTimeout(r, 3000))
                continue
            }

            for (const job of jobs) {
                await deleteFileFromR2(job)
                await redis.zrem(ZSET_KEY, job)
            }
        } catch (err) {
            console.error('❌ Lỗi worker xoá file:', err)
            await new Promise((r) => setTimeout(r, 5000))
        }
    }
}

startWorker()
