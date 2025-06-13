// pages/api/create-process-job.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'
import fetch from 'node-fetch'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL!

async function triggerCloudRunJob(token: string) {
    const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: '{}', // body rỗng vì biến môi trường JOB_ID đã cố định trong template
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Lỗi gọi Cloud Run Job: ${res.status} ${text}`)
    }
    return await res.json()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const { videoUrl, audioUrl, outputName } = req.body
    if (!videoUrl || !audioUrl || !outputName)
        return res.status(400).json({ error: 'Thiếu tham số videoUrl, audioUrl hoặc outputName' })

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const jobPayload = { jobId, videoUrl, audioUrl, outputName, createdAt: Date.now() }

    try {
        // Lưu jobPayload vào Redis Hash
        await redis.hset('onlook:jobs', jobId, JSON.stringify(jobPayload))

        // Lấy token Google
        const token = await getGoogleAccessToken()

        // Gọi Cloud Run Job (biến môi trường JOB_ID đã cố định trong template Cloud Run)
        const cloudRunResult = await triggerCloudRunJob(token)

        return res.status(200).json({
            message: 'Job đã được tạo và Cloud Run Job đang chạy',
            jobId,
            cloudRunResult,
        })
    } catch (error: any) {
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker', details: error.message || error.toString() })
    }
}
