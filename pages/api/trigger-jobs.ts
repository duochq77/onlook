import { Redis } from '@upstash/redis'
import { exec } from 'child_process'
import type { NextApiRequest, NextApiResponse } from 'next'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const dynamic = 'force-dynamic'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // 1. Kiểm tra hàng đợi clean-video-worker
        const cleanJobs = await redis.llen('ffmpeg-jobs:clean')
        if (cleanJobs > 0) {
            exec(
                `gcloud run jobs execute clean-video-worker --region=asia-southeast1 --project=onlook-main`,
                (err, stdout, stderr) => {
                    console.log('▶️ Đã trigger clean-video-worker', stdout, stderr)
                }
            )
        }

        // 2. Kiểm tra hàng đợi merge-video-worker
        const mergeJobs = await redis.llen('ffmpeg-jobs:merge')
        if (mergeJobs > 0) {
            exec(
                `gcloud run jobs execute merge-video-worker --region=asia-southeast1 --project=onlook-main`,
                (err, stdout, stderr) => {
                    console.log('▶️ Đã trigger merge-video-worker', stdout, stderr)
                }
            )
        }

        // 3. Kiểm tra hàng đợi upload-video-worker
        const uploadJobs = await redis.llen('ffmpeg-jobs:upload')
        if (uploadJobs > 0) {
            exec(
                `gcloud run jobs execute upload-video-worker --region=asia-southeast1 --project=onlook-main`,
                (err, stdout, stderr) => {
                    console.log('▶️ Đã trigger upload-video-worker', stdout, stderr)
                }
            )
        }

        res.status(200).json({ message: '✅ Đã kiểm tra và trigger job nếu có.' })
    } catch (error) {
        console.error('❌ Lỗi khi trigger job:', error)
        res.status(500).json({ error: 'Trigger job thất bại.' })
    }
}
