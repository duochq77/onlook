// ✅ API nhận yêu cầu ghép video sạch + audio → merged.mp4
import { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Phải dùng POST' })
    }

    const { videoFile, audioFile, outputName } = req.body

    if (!videoFile || !audioFile || !outputName) {
        return res.status(400).json({ error: 'Thiếu thông tin video/audio/output' })
    }

    await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({
        video: videoFile,
        audio: audioFile,
        outputName,
    }))

    return res.status(200).json({ message: 'Đã đẩy job merge vào queue' })
}
