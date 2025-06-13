import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import fetch from 'node-fetch'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL!

async function triggerCloudRunWorker() {
    // Gọi HTTP POST đến Worker Cloud Run Service để "thức dậy"
    const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // body có thể rỗng vì worker luôn chạy và lắng nghe queue
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Lỗi gọi Worker Cloud Run: ${res.status} ${text}`)
    }
    return await res.json()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { jobId, videoUrl, audioUrl, outputName } = req.body

    if (!jobId || !videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số bắt buộc (jobId, videoUrl, audioUrl, outputName)' })
    }

    const jobPayload = { jobId, videoUrl, audioUrl, outputName, createdAt: Date.now() }

    try {
        // Đẩy job vào Redis queue
        await redis.lpush('onlook:job-queue', JSON.stringify(jobPayload))

        // Kích hoạt worker (gọi HTTP POST)
        await triggerCloudRunWorker()

        return res.status(200).json({ message: 'Job đã được tạo và worker Cloud Run đã được kích hoạt', jobId })
    } catch (error: any) {
        console.error('❌ Lỗi tạo job hoặc gọi worker:', error)
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker', details: error.message || error.toString() })
    }
}
