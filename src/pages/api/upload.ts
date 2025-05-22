import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

export const config = {
    api: {
        bodyParser: false,
    },
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const form = new formidable.IncomingForm({ uploadDir: '/tmp', keepExtensions: true })

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('❌ Lỗi khi parse form:', err)
            return res.status(500).json({ error: 'Lỗi parse form data' })
        }

        const file = files.file?.[0] || files.file
        const path = fields.path?.[0] || fields.path

        if (!file || !path) {
            return res.status(400).json({ error: 'Thiếu file hoặc path' })
        }

        const fileBuffer = fs.readFileSync(file.filepath)

        const { error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(path, fileBuffer, {
                contentType: file.mimetype || 'application/octet-stream',
                upsert: true,
            })

        if (error) {
            console.error('❌ Upload lỗi Supabase:', error)
            return res.status(500).json({ error: 'Upload failed', detail: error })
        }

        const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/${path}`

        return res.status(200).json({ url: fileUrl, path })
    })
}
