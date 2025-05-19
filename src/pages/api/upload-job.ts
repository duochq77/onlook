import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import 'dotenv/config'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { inputVideo, inputAudio, outputName } = req.body

    if (!inputVideo || !inputAudio || !outputName) {
        return res.status(400).json({ error: 'Thiếu inputVideo, inputAudio hoặc outputName' })
    }

    try {
        await redis.rpush('ffmpeg-jobs:video', JSON.stringify({ inputVideo, inputAudio, outputName }))
        return res.status(200).json({ success: true, message: 'Đã đẩy job vào Redis thành công' })
    } catch (err: any) {
        console.error('❌ Redis push error:', err)
        return res.status(500).json({ error: 'Không thể đẩy job vào Redis' })
    }
}
