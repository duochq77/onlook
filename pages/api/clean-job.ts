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
    const jobDataString = JSON.stringify(jobData)

    try {
        console.log('📥 Nhận job CLEAN:', jobDataString)
        await redis.rpush('ffmpeg-jobs:clean', jobDataString)
        await redis.set(`debug:clean:push:${outputName}`, jobDataString, { ex: 600 })
        console.log('✅ Đã đẩy job vào Redis và lưu debug key')
    } catch (err) {
        console.error('❌ Redis push failed:', err)
        return res.status(500).json({ error: 'Redis push failed' })
    }

    try {
        const triggerURL =
            'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/clean-video-worker:run'

        const response = await fetch(triggerURL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.GOOGLE_CLOUD_RUN_TOKEN!}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.warn('⚠️ Gọi Cloud Run Job thất bại:', errorText)
        } else {
            console.log('🚀 Đã gọi clean-video-worker thành công (status):', response.status)
        }
    } catch (err) {
        console.warn('❌ Không thể gọi Cloud Run Trigger:', err)
    }

    return res.status(200).json({ message: '✅ CLEAN job đã được tạo và kích hoạt' })
}
