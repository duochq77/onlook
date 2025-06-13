import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'
import fetch from 'node-fetch'

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL!

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function triggerCloudRunJob(token: string, jobId: string) {
    // Gửi jobId làm payload cho Cloud Run Worker
    const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
    })

    if (!res.ok) {
        const text = await res.text()
        console.error(`❌ Lỗi gọi Cloud Run Job: ${res.status} ${text}`)
        throw new Error(`Lỗi gọi Cloud Run Job: ${res.status} ${text}`)
    }
    return await res.json()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { videoUrl, audioUrl, outputName } = req.body
    if (!videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số videoUrl, audioUrl hoặc outputName' })
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const jobPayload = { jobId, videoUrl, audioUrl, outputName, createdAt: Date.now() }

    try {
        // Lưu job dưới dạng hash để Worker dễ truy vấn
        await redis.hset('onlook:jobs', jobId, JSON.stringify(jobPayload))

        const token = await getGoogleAccessToken()
        console.log('🔑 Google Access Token:', token.slice(0, 10) + '...')

        const cloudRunResult = await triggerCloudRunJob(token, jobId)
        console.log('☁️ Cloud Run Job trigger result:', cloudRunResult)

        return res.status(200).json({ message: 'Job đã được tạo và Cloud Run Job đang chạy', jobId })
    } catch (error: any) {
        console.error('❌ Lỗi tạo job hoặc gọi Worker:', error)
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker', details: error.message || error.toString() })
    }
}
