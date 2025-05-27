import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end()

    const { inputVideo, outputName } = req.body

    if (!inputVideo || !outputName) {
        return res.status(400).json({ error: 'Thiếu inputVideo hoặc outputName' })
    }

    const job = {
        inputVideo: inputVideo.replace(/^stream-files\//, ''), // chuẩn hoá path
        outputName
    }

    await redis.rpush('ffmpeg-jobs:clean', JSON.stringify(job))

    return res.status(200).json({ message: '✅ Đã gửi job vào clean queue', job })
}
