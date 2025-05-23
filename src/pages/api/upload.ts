import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const form = formidable({
        uploadDir: '/tmp',
        keepExtensions: true
    })

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: 'Form parse error' })

        const file = files.file
        const filePath = fields.path?.[0]

        if (!file || Array.isArray(file) || !filePath) {
            return res.status(400).json({ error: 'Thiếu file hoặc path' })
        }

        const fileData = file as formidable.File
        const buffer = fs.readFileSync(fileData.filepath)

        const { error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(filePath, buffer, {
                contentType: 'application/octet-stream',
                upsert: true,
            })

        if (error) return res.status(500).json({ error: 'Upload lỗi', details: error })
        return res.status(200).json({ message: '✅ Upload thành công', path: filePath })
    })
}
