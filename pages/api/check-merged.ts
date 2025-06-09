// pages/api/check-merged.ts
import type { NextApiRequest, NextApiResponse } from 'next'

const bucket = 'stream-files'
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { fileName } = req.query

    if (!fileName || typeof fileName !== 'string') {
        return res.status(400).json({ error: 'Thiếu hoặc sai fileName' })
    }

    const publicUrl = `${baseUrl}/storage/v1/object/public/${bucket}/outputs/${fileName}`

    try {
        const headRes = await fetch(publicUrl, { method: 'HEAD' })
        if (headRes.ok) {
            return res.status(200).json({ ready: true, url: publicUrl })
        } else {
            return res.status(200).json({ ready: false })
        }
    } catch (err) {
        console.error('❌ Lỗi khi fetch HEAD Supabase:', err)
        return res.status(500).json({ error: 'Không kiểm tra được file' })
    }
}
