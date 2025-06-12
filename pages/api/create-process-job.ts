import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'
import fetch from 'node-fetch'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,   // https://clean-humpback-36746.upstash.io
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function triggerCloudRunJob(token: string) {
    const res = await fetch(
        'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/process-video-worker:run',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // có thể để rỗng
        }
    )
    if (!res.ok) {
        const text = await res.text()
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
        console.log('🔑 Redis URL:', process.env.UPSTASH_REDIS_REST_URL)
        console.log('🔑 Redis Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'OK' : 'MISSING')

        await redis.lpush('onlook:process-video-queue', JSON.stringify(jobPayload))
        console.log(`🟢 Đã đẩy job vào queue: ${jobId}`)

        const token = await getGoogleAccessToken()
        console.log('🔑 Google Access Token:', token.slice(0, 10) + '...')

        await triggerCloudRunJob(token)

        return res.status(200).json({ message: 'Job đã được tạo và Cloud Run Job đang chạy', jobId })
    } catch (error: any) {
        console.error('❌ Lỗi đẩy job hoặc gọi worker:', error)
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker', details: error.message || error.toString() })
    }
}
