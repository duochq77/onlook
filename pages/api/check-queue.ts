import type { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    tls: {},
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        const jobsRaw = await redis.lrange('video-process-jobs', 0, -1)

        // ✅ Parse từng job trước khi trả về
        const jobs = jobsRaw.map((j) => {
            try {
                return JSON.parse(j)
            } catch {
                return { raw: j, error: 'Invalid JSON' }
            }
        })

        return res.status(200).json({
            count: jobs.length,
            jobs,
        })
    } catch (err: any) {
        console.error('❌ Lỗi khi đọc Redis:', err)
        return res.status(500).json({ error: 'Lỗi khi đọc Redis', message: err.message })
    }
}
