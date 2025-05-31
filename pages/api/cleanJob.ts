// pages/api/cleanJob.ts
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

    const { inputVideo, outputName } = req.body

    if (typeof inputVideo !== 'string' || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid inputVideo or outputName' })
    }

    console.log('📥 Nhận job CLEAN:', { inputVideo, outputName })

    try {
        const result = await redis.rpush('ffmpeg-jobs:clean', JSON.stringify({ inputVideo, outputName }))
        console.log('✅ Đẩy job vào Redis CLEAN thành công:', result)
    } catch (err) {
        console.error('❌ Redis lỗi:', err)
        return res.status(500).json({ error: 'Redis push failed' })
    }

    const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) {
        console.warn('⚠️ Thiếu biến môi trường SITE_URL')
        return res.status(500).json({ error: 'SITE_URL is not defined' })
    }

    try {
        const response = await fetch(`${siteUrl}/api/trigger-clean`, {
            method: 'POST',
        })
        console.log('🚀 Triggered clean job, status:', response.status)
    } catch (err) {
        console.warn('⚠️ Trigger clean failed:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job created and triggered' })
}
