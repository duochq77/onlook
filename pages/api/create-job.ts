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

    const { inputVideo, inputAudio, outputName } = req.body
    if (!inputVideo || !inputAudio || !outputName) {
        return res.status(400).json({ error: 'Missing inputVideo, inputAudio, or outputName' })
    }

    console.log('📥 Nhận job:', { inputVideo, inputAudio, outputName })

    try {
        const result = await redis.rpush('ffmpeg-jobs:clean', JSON.stringify({ inputVideo, inputAudio, outputName }))
        console.log('✅ Ghi Redis thành công. Kết quả:', result)
    } catch (err) {
        console.error('❌ Ghi Redis thất bại:', err)
    }

    try {
        const triggerRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`, { method: 'POST' })
        console.log('🚀 Trigger worker:', triggerRes.status)
    } catch (err) {
        console.error('⚠️ Trigger job thất bại:', err)
    }

    return res.status(200).json({ message: '✅ Job created and triggered (with logs)' })
}
