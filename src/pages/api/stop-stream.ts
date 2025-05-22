import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { userId } = req.query

    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Thiếu userId' })
    }

    const timestamp = new Date().toISOString()

    const { error } = await supabase
        .from('stream_status')
        .upsert([
            {
                user_id: userId,
                ended_at: timestamp,
            },
        ])

    if (error) {
        console.error('❌ Lỗi ghi thời điểm kết thúc stream:', error)
        return res.status(500).json({ error: 'Ghi trạng thái thất bại' })
    }

    console.log(`📌 Đã ghi lại kết thúc livestream của ${userId} tại ${timestamp}`)
    return res.status(200).json({ message: 'Đã ghi nhận kết thúc livestream' })
}
