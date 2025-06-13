import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'
import fetch from 'node-fetch'

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL!

async function triggerCloudRunJob(token: string, jobPayload: any) {
    // Chuyển jobPayload thành JSON string để truyền qua biến môi trường JOB_PAYLOAD
    const jobPayloadStr = JSON.stringify(jobPayload)

    const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            env: [
                {
                    name: 'JOB_PAYLOAD',
                    value: jobPayloadStr,
                }
            ]
        }),
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
        const token = await getGoogleAccessToken()
        console.log('🔑 Google Access Token:', token.slice(0, 10) + '...')

        const cloudRunResult = await triggerCloudRunJob(token, jobPayload)
        console.log('☁️ Cloud Run Job trigger result:', cloudRunResult)

        return res.status(200).json({ message: 'Job đã được tạo và Cloud Run Job đang chạy', jobId })
    } catch (error: any) {
        console.error('❌ Lỗi gọi Cloud Run Job:', error)
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker', details: error.message || error.toString() })
    }
}
