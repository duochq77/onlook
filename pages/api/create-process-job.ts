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
        return res.status(400).json({
            error: 'Thiếu tham số bắt buộc: jobId, videoUrl, audioUrl, outputName',
        })
    }

    const jobPayload = {
        jobId,
        videoUrl,
        audioUrl,
        outputName,
        createdAt: Date.now(),
    }

    try {
        console.log('📦 Push job vào Redis:', jobPayload)
        await redis.lpush('onlook:job-queue', JSON.stringify(jobPayload))

        return res.status(200).json({ message: '✅ Job đã được tạo thành công', jobId })
    } catch (error: any) {
        console.error('❌ Lỗi khi push job vào Redis:', error)
        return res.status(500).json({
            error: 'Không thể tạo job',
            details: error.message || error.toString(),
        })
    }
}
