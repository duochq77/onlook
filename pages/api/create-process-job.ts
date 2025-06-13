import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL!

async function triggerCloudRunJob(token: string, jobId: string) {
    // Gọi Google Cloud Run job với biến môi trường JOB_ID = jobId
    const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        // Google Cloud Run Jobs API không cho override biến env trực tiếp khi gọi jobs.run,
        // nên ta để body rỗng, dữ liệu job lưu trên Redis và Worker lấy dựa trên JOB_ID env
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
        // Lưu jobPayload dưới Redis Hash với key là jobId
        await redis.hset('onlook:jobs', jobId, JSON.stringify(jobPayload))
        console.log(`🟢 Đã lưu job ${jobId} vào Redis`)

        const token = await getGoogleAccessToken()
        console.log('🔑 Google Access Token:', token.slice(0, 10) + '...')

        // Gọi Cloud Run Job (body rỗng vì không truyền jobPayload qua)
        await triggerCloudRunJob(token, jobId)

        return res.status(200).json({ message: 'Job đã được tạo và Cloud Run Job đang chạy', jobId })
    } catch (error: any) {
        console.error('❌ Lỗi tạo job hoặc gọi Worker:', error)
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker', details: error.message || error.toString() })
    }
}
