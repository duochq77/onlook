import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL!

async function triggerCloudRunJob(token: string, jobId: string) {
    // Gọi Google Cloud Run Job API với biến môi trường JOB_ID = jobId trong Cloud Run Job config
    const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        // Body rỗng vì job data lưu trong Redis, worker lấy dựa trên JOB_ID
        body: JSON.stringify({}),
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

    const { videoUrl, audioUrl, outputName, jobId } = req.body

    if (!videoUrl || !audioUrl || !outputName || !jobId) {
        return res.status(400).json({ error: 'Thiếu tham số bắt buộc (videoUrl, audioUrl, outputName, jobId)' })
    }

    const jobPayload = { jobId, videoUrl, audioUrl, outputName, createdAt: Date.now() }

    try {
        // Lưu jobPayload dưới Redis hash với key là jobId
        await redis.hset('onlook:jobs', jobId, JSON.stringify(jobPayload))
        console.log(`🟢 Đã lưu job ${jobId} vào Redis`)

        const token = await getGoogleAccessToken()
        console.log('🔑 Google Access Token:', token.slice(0, 10) + '...')

        // Gọi Cloud Run Job (body rỗng)
        await triggerCloudRunJob(token, jobId)

        return res.status(200).json({ message: 'Job đã được tạo và Cloud Run Job đang chạy', jobId })
    } catch (error: any) {
        console.error('❌ Lỗi tạo job hoặc gọi Worker:', error)
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker', details: error.message || error.toString() })
    }
}
