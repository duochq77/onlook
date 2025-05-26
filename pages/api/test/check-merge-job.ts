// pages/api/test/check-merge-job.ts
import { Redis } from '@upstash/redis'
import type { NextApiRequest, NextApiResponse } from 'next'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
    const jobs = await redis.lrange('ffmpeg-jobs:merge', 0, -1)
    res.status(200).json({
        queue: 'ffmpeg-jobs:merge',
        length: jobs.length,
        jobs: jobs.map((j) => JSON.parse(j))
    })
}
