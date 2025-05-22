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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const form = new formidable.IncomingForm({
        uploadDir: '/tmp',
        keepExtensions: true,
    })

    form.parse(req, async (err, fields, files) => {
        try {
            if (err) {
                console.error('❌ Formidable error:', err)
                return res.status(500).json({ error: 'Lỗi xử lý form' })
            }

            const file = files.file
            const filePath = fields.path?.[0]

            if (!file || Array.isArray(file) || !filePath) {
                return res.status(400).json({ error: 'Thiếu file hoặc đường dẫn path' })
            }

            const fileData = file as formidable.File
            const fileBuffer = fs.readFileSync(fileData.filepath)

            const { error } = await supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET!)
                .upload(filePath, fileBuffer, {
                    contentType: 'application/octet-stream',
                    upsert: true,
                })

            if (error) {
                console.error('❌ Upload thất bại:', error)
                return res.status(500).json({ error: 'Lỗi upload lên Supabase' })
            }

            return res.status(200).json({ message: '✅ Upload thành công', path: filePath })
        } catch (e) {
            console.error('❌ Lỗi upload:', e)
            return res.status(500).json({ error: 'Lỗi không xác định' })
        }
    })
}
