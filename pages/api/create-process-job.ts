import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { videoUrl, audioUrl, outputName } = req.body

    if (!videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số videoUrl, audioUrl, outputName' })
    }

    const timestamp = Date.now()
    const jobId = `job-${timestamp}-${Math.random().toString(36).substring(2, 8)}`

    const jobPayload = {
        jobId,
        videoUrl,
        audioUrl,
        outputName,
        createdAt: timestamp,
    }

    try {
        console.log('📦 Đẩy job vào Redis:', jobPayload)
        await redis.lpush('video-process-jobs', JSON.stringify(jobPayload))
        return res.status(200).json({ message: '✅ Đã đẩy job thành công', jobId })
    } catch (err: any) {
        console.error('❌ Lỗi Redis:', err)
        return res.status(500).json({ error: 'Lỗi Redis', details: err.message })
    }
}
