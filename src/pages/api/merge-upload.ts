import { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Phương thức không được hỗ trợ' })
    }

    const { videoFile, audioFile, outputName } = req.body

    if (!videoFile || !audioFile || !outputName) {
        return res.status(400).json({ error: 'Thiếu thông tin video, audio hoặc output' })
    }

    try {
        await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({
            video: videoFile,
            audio: audioFile,
            outputName,
        }))

        console.log(`📥 Merge job đã thêm vào hàng đợi: ${outputName}`)
        return res.status(200).json({ message: 'Đã gửi job merge' })
    } catch (err) {
        console.error('❌ Gửi job merge thất bại:', err)
        return res.status(500).json({ error: 'Gửi job merge thất bại' })
    }
}
