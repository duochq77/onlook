import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { inputVideo, inputAudio, outputName } = req.body

    if (!inputVideo || !inputAudio || !outputName) {
        return res.status(400).json({
            error: 'Missing inputVideo, inputAudio, or outputName'
        })
    }

    console.log('📩 Nhận job mới:', { inputVideo, inputAudio, outputName })

    // Đẩy job vào Redis queue
    await redis.rpush(
        'ffmpeg-jobs:clean',
        JSON.stringify({ inputVideo, inputAudio, outputName })
    )

    // Gọi API trigger để khởi động worker phía Cloud Run
    try {
        const triggerUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`
        const triggerRes = await fetch(triggerUrl, { method: 'POST' })

        if (!triggerRes.ok) {
            console.error('❌ Trigger job failed:', await triggerRes.text())
        }
    } catch (err) {
        console.error('⚠️ Trigger job fetch error:', err)
    }

    return res.status(200).json({
        message: '✅ Job created and triggered',
        job: { inputVideo, inputAudio, outputName }
    })
}
