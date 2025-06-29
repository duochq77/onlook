import type { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

let redis: Redis | null = null

function getRedisClient() {
    if (!redis) {
        redis = new Redis({
            host: process.env.REDIS_HOST!,
            port: Number(process.env.REDIS_PORT!),
            password: process.env.REDIS_PASSWORD!,
            tls: {},
        })
    }
    return redis
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const { sellerId, videoUrl, audioUrl, outputName } = req.body

    if (!sellerId || !videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số sellerId, videoUrl, audioUrl, outputName' })
    }

    const timestamp = Date.now()
    const jobId = `job-${timestamp}-${Math.random().toString(36).substring(2, 8)}`
    const finalOutputName = outputName.endsWith('.mp4') ? outputName : `${outputName}.mp4`

    const jobPayload = {
        jobId,
        sellerId,
        videoUrl,
        audioUrl,
        outputName: finalOutputName,
        createdAt: timestamp,
    }

    try {
        const redis = getRedisClient()
        await redis.lpush('video-process-jobs', JSON.stringify(jobPayload))
        return res.status(200).json({ message: 'Đã tạo job thành công', jobId })
    } catch (err: any) {
        return res.status(500).json({ error: 'Không thể tạo job', details: err.message })
    }
}
