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

    // Debug log toàn bộ body
    console.log('📦 Body nhận được:', req.body)

    const { inputVideo, outputName } = req.body || {}

    if (typeof inputVideo !== 'string' || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid inputVideo or outputName' })
    }

    const jobData = { inputVideo, outputName }

    try {
        console.log('📥 Nhận job CLEAN:', jobData)
        const pushResult = await redis.rpush('ffmpeg-jobs:clean', JSON.stringify(jobData))
        console.log('✅ Đẩy job vào Redis:', pushResult)
    } catch (err) {
        console.error('❌ Lỗi khi push Redis:', err)
        return res.status(500).json({ error: 'Redis push failed' })
    }

    try {
        const siteURL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
        if (!siteURL) throw new Error('SITE_URL không tồn tại')

        const triggerRes = await fetch(`${siteURL}/api/trigger-clean`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })

        console.log('🚀 Trigger gọi thành công:', triggerRes.status)
    } catch (err) {
        console.warn('⚠️ Gọi trigger job thất bại:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job created and triggered' })
}
