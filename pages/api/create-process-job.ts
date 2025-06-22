import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Hàm chuyển URL tương đối thành tuyệt đối.
 * Ví dụ: /videos/a.mp4 → https://onlook.vn/videos/a.mp4
 */
const makeAbsoluteUrl = (url: string): string => {
    if (/^https?:\/\//i.test(url)) return url
    const base = process.env.BASE_MEDIA_URL || 'https://onlook.vn'
    return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { videoUrl, audioUrl, outputName } = req.body

    if (!videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số videoUrl, audioUrl, outputName' })
    }

    const timestamp = Date.now()
    const jobId = `job-${timestamp}-${Math.random().toString(36).substring(2, 8)}`
    const finalOutputName = outputName.endsWith('.mp4') ? outputName : `${outputName}.mp4`

    const jobPayload = {
        jobId,
        videoUrl: makeAbsoluteUrl(videoUrl),
        audioUrl: makeAbsoluteUrl(audioUrl),
        outputName: finalOutputName,
        createdAt: timestamp,
    }

    try {
        console.log('📦 Đẩy job vào Redis:', jobPayload)
        await redis.lpush('video-process-jobs', JSON.stringify(jobPayload))
        console.log(`✅ Job ${jobId} đã được thêm vào hàng đợi`)
        return res.status(200).json({ message: 'Đã tạo job thành công', jobId })
    } catch (err: any) {
        console.error('❌ Lỗi Redis:', err)
        return res.status(500).json({ error: 'Lỗi Redis', details: err.message })
    }
}
