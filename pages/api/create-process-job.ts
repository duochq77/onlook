import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import fetch from 'node-fetch'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ✅ Kiểm tra biến môi trường Cloud Run URL
const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL
if (!CLOUD_RUN_URL) {
    throw new Error('❌ Thiếu biến môi trường CLOUD_RUN_URL trong .env hoặc Vercel')
}

async function triggerCloudRunWorker() {
    const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Lỗi gọi Cloud Run Worker: ${res.status} ${text}`)
    }

    return await res.json()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { jobId, videoUrl, audioUrl, outputName } = req.body

    if (!jobId || !videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu tham số: jobId, videoUrl, audioUrl, outputName' })
    }

    const jobPayload = {
        jobId,
        videoUrl,
        audioUrl,
        outputName,
        createdAt: Date.now(),
    }

    try {
        console.log('📦 Đẩy job vào Redis:', jobPayload)
        await redis.lpush('onlook:job-queue', JSON.stringify(jobPayload))

        console.log('🚀 Gọi Cloud Run worker:', CLOUD_RUN_URL)
        await triggerCloudRunWorker()

        return res.status(200).json({ message: '✅ Job đã được đẩy vào hàng đợi', jobId })
    } catch (err: any) {
        console.error('❌ Lỗi gửi job:', err)
        return res.status(500).json({ error: 'Không thể gửi job', details: err.message })
    }
}
