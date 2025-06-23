import type { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    tls: {}, // Bắt buộc với Upstash Redis
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const jobs = await redis.lrange('video-process-jobs', 0, -1)
        res.status(200).json({ count: jobs.length, jobs })
    } catch (error: any) {
        console.error('❌ Lỗi kiểm tra queue:', error)
        res.status(500).json({ error: 'Redis check failed', message: error.message })
    } finally {
        redis.disconnect()
    }
}
