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

    const { inputVideo, outputName } = req.body

    if (typeof inputVideo !== 'string' || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid inputVideo or outputName' })
    }

    const job = JSON.stringify({ inputVideo, outputName })
    console.log('📥 Nhận job CLEAN:', job)

    // Gửi job vào Redis
    try {
        const result = await redis.rpush('ffmpeg-jobs:clean', job)
        console.log('✅ Đã đẩy vào Redis:', result)
    } catch (err) {
        console.error('❌ Lỗi Redis:', err)
        return res.status(500).json({ error: 'Redis push failed' })
    }

    // Gọi API trigger-clean
    try {
        const triggerRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-clean`, {
            method: 'POST'
        })

        const bodyText = await triggerRes.text()
        console.log(`🚀 Gọi trigger-clean status: ${triggerRes.status} | body: ${bodyText}`)
    } catch (err) {
        console.error('⚠️ Lỗi khi gọi trigger-clean:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job created and triggered' })
}
