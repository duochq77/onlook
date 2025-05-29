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

    const { cleanVideoPath, inputAudio, outputName } = req.body
    if (!cleanVideoPath || !inputAudio || !outputName) {
        return res.status(400).json({ error: 'Missing cleanVideoPath, inputAudio, or outputName' })
    }

    console.log('📥 Nhận job MERGE:', { cleanVideoPath, inputAudio, outputName })

    try {
        await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({ cleanVideoPath, inputAudio, outputName }))
        console.log('✅ Ghi Redis MERGE thành công.')
    } catch (err) {
        console.error('❌ Ghi Redis MERGE thất bại:', err)
    }

    try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`, { method: 'POST' })
    } catch (err) {
        console.error('⚠️ Trigger job MERGE thất bại:', err)
    }

    return res.status(200).json({ message: '✅ MERGE job created and triggered.' })
}
