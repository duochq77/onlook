import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const config = {
    api: { bodyParser: true },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { outputName } = req.body
    if (typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Missing outputName' })
    }

    const cleanVideoPath = `stream-files/clean-videos/${outputName}`
    const audioPath = `stream-files/input-audios/${outputName.replace('.mp4', '.mp3')}`
    const mergedOutputName = outputName.replace('.mp4', '-merged.mp4')

    const jobData = {
        cleanVideo: cleanVideoPath,
        audio: audioPath,
        outputName: mergedOutputName,
    }

    try {
        console.log('🎬 Gửi job MERGE:', jobData)
        await redis.rpush('ffmpeg-jobs:merge', JSON.stringify(jobData))
        await redis.set(`debug:merge:push:${mergedOutputName}`, JSON.stringify(jobData), { ex: 600 })
    } catch (err) {
        console.error('❌ Redis push lỗi:', err)
        return res.status(500).json({ error: 'Redis push failed' })
    }

    try {
        const response = await fetch(
            'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/merge-video-worker:run',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.GOOGLE_CLOUD_RUN_TOKEN!}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        if (!response.ok) {
            const errText = await response.text()
            console.warn('⚠️ Trigger merge job thất bại:', errText)
        } else {
            console.log('🚀 Merge job trigger thành công:', response.status)
        }
    } catch (err) {
        console.warn('❌ Không thể gọi merge-video-worker:', err)
    }

    return res.status(200).json({ message: '✅ MERGE job created & Cloud Run job triggered' })
}
