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

    console.log('📥 Nhận job CLEAN:', { inputVideo, outputName })

    try {
        const result = await redis.rpush('ffmpeg-jobs:clean', JSON.stringify({ inputVideo, outputName }))
        console.log('✅ Đẩy job vào Redis clean thành công:', result)
    } catch (err) {
        console.error('❌ Lỗi Redis khi đẩy job CLEAN:', err)
        return res.status(500).json({ error: 'Failed to push job to Redis' })
    }

    try {
        const triggerRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`, {
            method: 'POST'
        })
        console.log('🚀 Gọi trigger-jobs thành công:', triggerRes.status)
    } catch (err) {
        console.error('⚠️ Trigger job thất bại:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job created and triggered' })
}
