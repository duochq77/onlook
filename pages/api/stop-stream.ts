import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const config = {
    api: {
        bodyParser: true,
    },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { outputName } = req.body || {}
    if (typeof outputName !== 'string' || !outputName.endsWith('.mp4')) {
        return res.status(400).json({ error: 'Invalid outputName' })
    }

    try {
        const redisKey = `cleanup-after:${outputName}`
        await redis.set(redisKey, 'pending', { ex: 600 }) // ⏳ 10 phút
        console.log('🕒 Đã ghi key Redis:', redisKey)
    } catch (err) {
        console.error('❌ Redis set error:', err)
        return res.status(500).json({ error: 'Redis set failed' })
    }

    try {
        const response = await fetch(
            'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/cleanup-livestream-worker:run',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.GOOGLE_CLOUD_RUN_TOKEN!}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.warn('⚠️ Trigger cleanup-livestream-worker thất bại:', errorText)
        } else {
            console.log('🚀 Trigger cleanup-livestream-worker thành công')
        }
    } catch (err) {
        console.warn('❌ Không thể gọi job cleanup-livestream-worker:', err)
    }

    return res.status(200).json({ message: '🛑 Đã nhận tín hiệu kết thúc livestream & khởi động xoá sau 10 phút' })
}
