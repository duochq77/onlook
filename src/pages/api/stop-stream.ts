import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { userId } = req.query

    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Thiếu userId' })
    }

    const endedAt = new Date().toISOString()

    const { error } = await supabase
        .from('stream_status')
        .upsert([{ user_id: userId, ended_at: endedAt }])

    if (error) {
        console.error('❌ Lỗi ghi stream_status:', error)
        return res.status(500).json({ error: 'Ghi trạng thái thất bại' })
    }

    // 🧹 Đẩy job xoá file final sau 5 phút
    await redis.rpush('ffmpeg-jobs:cleanup', JSON.stringify({
        deleteType: 'final',
        outputName: `clean-${userId}.mp4`,
        endedAt: Date.now()
    }))

    console.log(`📌 Đã ghi thời điểm kết thúc và tạo job cleanup cho ${userId}`)
    return res.status(200).json({ message: 'Đã ghi nhận kết thúc livestream' })
}
