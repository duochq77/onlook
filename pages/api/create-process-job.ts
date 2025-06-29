import type { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

let redis: Redis | null = null

function getRedisClient() {
    if (!redis) {
        redis = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
            password: process.env.REDIS_PASSWORD,
            tls: {},
        })
    }
    return redis
}

const makeAbsoluteUrl = (url: string): string => {
    if (/^https?:\/\//i.test(url)) return url
    const base = process.env.BASE_MEDIA_URL || 'https://onlook.vn'
    return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const { sellerId, jobId, videoUrl, audioUrl, outputName } = req.body
    if (!sellerId || !jobId || !videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số bắt buộc.' })
    }

    const jobPayload = {
        sellerId,
        jobId,
        videoUrl: makeAbsoluteUrl(videoUrl),
        audioUrl: makeAbsoluteUrl(audioUrl),
        outputName,
        createdAt: Date.now(),
    }

    try {
        const redis = getRedisClient()
        await redis.lpush('video-process-jobs', JSON.stringify(jobPayload))
        return res.status(200).json({ message: 'Đã tạo job thành công', jobId })
    } catch (err: any) {
        return res.status(500).json({ error: 'Không thể tạo job', details: err.message })
    }
}
