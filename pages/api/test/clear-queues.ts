// pages/api/test/clear-queues.ts
import { Redis } from '@upstash/redis'
import type { NextApiRequest, NextApiResponse } from 'next'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
    const queues = [
        'ffmpeg-jobs:clean',
        'ffmpeg-jobs:merge',
        'ffmpeg-jobs:upload'
    ]

    const results = await Promise.all(
        queues.map(async (queue) => {
            const deleted = await redis.del(queue)
            return { queue, deleted }
        })
    )

    res.status(200).json({
        success: true,
        cleared: results
    })
}
