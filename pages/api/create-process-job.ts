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

    const { jobId, videoUrl, audioUrl, outputName } = req.body

    if (!jobId || !videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số: jobId, videoUrl, audioUrl, outputName' })
    }

    const jobPayload = {
        jobId,
        videoUrl,
        audioUrl,
        outputName,
        createdAt: Date.now(),
    }

    try {
        console.log('📦 Đẩy job vào Redis:', jobPayload)
        await redis.lpush('video-process-jobs', JSON.stringify(jobPayload))
        return res.status(200).json({ message: '✅ Job đã được đẩy vào hàng đợi', jobId })
    } catch (err: any) {
        console.error('❌ Lỗi gửi job:', err)
        return res.status(500).json({ error: 'Không thể gửi job', details: err.message })
    }
}
