import type { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

let redis: Redis | null = null

// ⚙️ Tạo kết nối Redis TCP (Upstash yêu cầu TLS)
function getRedisClient() {
    if (!redis) {
        redis = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
            password: process.env.REDIS_PASSWORD,
            tls: {}, // 🔐 Bắt buộc phải có với Redis TCP qua Upstash
        })
    }
    return redis
}

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
    console.log('📥 Nhận request:', { videoUrl, audioUrl, outputName })

    if (!videoUrl || !audioUrl || !outputName) {
        console.error('❌ Thiếu tham số trong body:', req.body)
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
        const redis = getRedisClient()
        console.log('📦 Đang đẩy job vào Redis TCP:', jobPayload)
        const pushResult = await redis.lpush('video-process-jobs', JSON.stringify(jobPayload))
        console.log('✅ Redis lpush result:', pushResult)

        return res.status(200).json({ message: 'Đã tạo job thành công', jobId })
    } catch (err: any) {
        console.error('❌ Lỗi Redis khi push job:', err)
        return res.status(500).json({ error: 'Không thể tạo job', details: err.message })
    }
}
