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

    const { inputVideo, outputName } = req.body || {}

    if (typeof inputVideo !== 'string' || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid inputVideo or outputName' })
    }

    const jobData = { inputVideo, outputName }

    try {
        console.log('📥 Nhận job CLEAN:', jobData)
        await redis.rpush('ffmpeg-jobs:clean', JSON.stringify(jobData))
        await redis.set(`debug:clean:push:${outputName}`, JSON.stringify(jobData), { ex: 600 })
        console.log('✅ Đẩy job vào Redis & lưu debug key')
    } catch (err) {
        console.error('❌ Lỗi khi push Redis:', err)
        return res.status(500).json({ error: 'Redis push failed' })
    }

    // Gọi Cloud Run Job clean-video-worker thông qua HTTP Trigger
    try {
        const triggerURL = 'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/clean-video-worker:run'

        const response = await fetch(triggerURL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.GOOGLE_CLOUD_RUN_TOKEN!}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.warn('⚠️ Trigger job thất bại:', errorText)
        } else {
            console.log('🚀 Trigger job clean-video-worker thành công:', response.status)
        }
    } catch (err) {
        console.warn('❌ Không thể gọi HTTP Trigger của clean-video-worker:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job created & triggered via Cloud Run' })
}
