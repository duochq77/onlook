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
        await redis.rpush('ffmpeg-jobs:clean', JSON.stringify({ inputVideo, outputName }))
        console.log('✅ Ghi Redis CLEAN thành công.')
    } catch (err) {
        console.error('❌ Ghi Redis CLEAN thất bại:', err)
    }

    try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`, { method: 'POST' })
    } catch (err) {
        console.error('⚠️ Trigger job CLEAN thất bại:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job created and triggered.' })
}
