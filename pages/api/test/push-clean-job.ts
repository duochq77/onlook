// pages/api/test/push-clean-job.ts

import { Redis } from '@upstash/redis'
import type { NextApiRequest, NextApiResponse } from 'next'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const job = {
        inputVideo: 'video-inputs/demo.mp4',
        inputAudio: 'audio-inputs/sample.mp3',
        outputName: 'manual-test.mp4',
        userId: 'test-user'
    }

    await redis.rpush('ffmpeg-jobs:clean', JSON.stringify(job))

    return res.status(200).json({
        success: true,
        queue: 'ffmpeg-jobs:clean',
        pushed: job
    })
}
