import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import { execSync } from 'child_process'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Hàm gọi Cloud Run Job để worker chạy batch (bạn sửa theo tên và region job của bạn)
async function triggerCloudRunJob() {
    try {
        // Gọi command gcloud deploy job (phải cài sẵn gcloud CLI trên môi trường backend)
        // Nếu backend không có shell access, cần chuyển sang API call Google Cloud Run
        execSync(`gcloud beta run jobs execute process-video-worker --region asia-southeast1 --project onlook-main`)
        console.log('✅ Đã gọi Cloud Run Job process-video-worker')
    } catch (err) {
        console.error('❌ Lỗi gọi Cloud Run Job:', err)
    }
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

    const jobPayload = {
        jobId,
        videoUrl,
        audioUrl,
        outputName,
        createdAt: Date.now(),
    }

    try {
        await redis.lpush('onlook:process-video-queue', JSON.stringify(jobPayload))
        console.log(`🟢 Đã đẩy job vào queue: ${jobId}`)

        // Gọi Cloud Run Job worker chạy xử lý batch (không chờ kết quả, không block API)
        triggerCloudRunJob()

        return res.status(200).json({ message: 'Job đã được tạo và Cloud Run Job đang chạy', jobId })
    } catch (error) {
        console.error('❌ Lỗi đẩy job vào queue hoặc gọi Cloud Run Job:', error)
        return res.status(500).json({ error: 'Không thể tạo job hoặc gọi worker' })
    }
}
