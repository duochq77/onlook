// pages/api/create-job.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { inputVideo, outputName } = req.body

    if (!inputVideo || !outputName) {
        return res.status(400).json({ error: 'Missing inputVideo or outputName' })
    }

    try {
        // Đẩy job vào hàng đợi clean
        await redis.rpush('ffmpeg-jobs:clean', JSON.stringify({ inputVideo, outputName }))

        // Gọi trigger để chạy clean-video-worker
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`, {
            method: 'POST'
        })

        return res.status(200).json({ message: '✅ Job created and triggered' })
    } catch (err) {
        console.error('❌ Error pushing job or triggering:', err)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}
