// pages/api/create-process-job.ts

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
        return res.status(400).json({ error: 'Thiếu tham số videoUrl, audioUrl hoặc outputName' })
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const jobPayload = {
        jobId,
        videoUrl,
        audioUrl,
        outputName,
        createdAt: Date.now(),
    }

    try {
        await redis.lpush('onlook:process-video-queue', JSON.stringify(jobPayload))
        console.log('🟢 Đã đẩy job vào queue:', jobId)
        return res.status(200).json({ message: 'Job đã được tạo', jobId })
    } catch (error) {
        console.error('❌ Lỗi đẩy job vào queue:', error)
        return res.status(500).json({ error: 'Không thể tạo job' })
    }
}
