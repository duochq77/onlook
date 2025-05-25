import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end()

    const { inputVideo, inputAudio, outputName } = req.body

    if (!inputVideo || !inputAudio || !outputName) {
        return res.status(400).json({ error: 'Thiếu thông tin job' })
    }

    // ✅ Optional: Log định dạng đúng bucket mới
    console.log('📝 Nhận job:', {
        inputVideo,  // ví dụ: stream-files/video-inputs/demo.mp4
        inputAudio,  // ví dụ: stream-files/audio-inputs/demo.mp3
        outputName   // ví dụ: demo-merged.mp4
    })

    const job = { inputVideo, inputAudio, outputName }
    await redis.rpush('ffmpeg-jobs:clean', JSON.stringify(job))

    return res.status(200).json({ message: '✅ Đã gửi job vào hàng ffmpeg-jobs:clean' })
}
