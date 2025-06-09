// pages/api/check-merged.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const bucket = 'stream-files'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { fileName } = req.query

    if (!fileName || typeof fileName !== 'string') {
        return res.status(400).json({ error: 'Thiếu hoặc sai fileName' })
    }

    const { data, error } = await supabase.storage.from(bucket).list('outputs', {
        search: fileName,
    })

    if (error) {
        console.error('❌ Lỗi kiểm tra Supabase:', error)
        return res.status(500).json({ error: 'Lỗi kiểm tra file' })
    }

    const found = data.find((item) => item.name === fileName)

    if (found) {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/outputs/${fileName}`
        return res.status(200).json({ ready: true, url })
    } else {
        return res.status(200).json({ ready: false })
    }
}
