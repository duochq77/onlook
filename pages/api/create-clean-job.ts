// pages/api/create-clean-job.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { inputVideo, outputName } = req.body

    if (typeof inputVideo !== 'string' || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid inputVideo or outputName' })
    }

    console.log('📥 Nhận job CLEAN:', { inputVideo, outputName })

    try {
        const result = await redis.rpush('ffmpeg-jobs:clean', JSON.stringify({ inputVideo, outputName }))
        console.log('✅ Đẩy job vào Redis CLEAN thành công:', result)
    } catch (err) {
        console.error('❌ Redis lỗi khi đẩy job CLEAN:', err)
        return res.status(500).json({ error: 'Failed to push job to Redis' })
    }

    try {
        const triggerRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-clean`, {
            method: 'POST',
        })
        console.log('🚀 Gọi trigger-clean thành công:', triggerRes.status)
    } catch (err) {
        console.error('⚠️ Gọi trigger-clean thất bại:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job created and triggered' })
}
