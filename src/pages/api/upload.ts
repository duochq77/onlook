import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/services/SupabaseService'
import { v4 as uuidv4 } from 'uuid'

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb' // Cho phép upload file lớn
        }
    }
}

/**
 * API: Upload file lên Supabase Storage
 * Phù hợp cho seller/admin upload video hoặc audio từ trình duyệt
 * 
 * Body (JSON):
 * {
 *   file: base64 string,
 *   filename: 'abc.mp4',
 *   folder: 'tmp' | 'uploads' | 'admin-assets' ...
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { file, filename, folder } = req.body

    if (!file || !filename || !folder) {
        return res.status(400).json({ error: 'Missing file, filename, or folder' })
    }

    try {
        const fileBuffer = Buffer.from(file, 'base64')
        const filePath = `${folder}/${uuidv4()}-${filename}`

        const { error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(filePath, fileBuffer, {
                contentType: 'application/octet-stream',
                upsert: false
            })

        if (error) throw error

        const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/${filePath}`

        return res.status(200).json({ url: fileUrl, path: filePath })
    } catch (err: any) {
        console.error('❌ Lỗi upload:', err)
        return res.status(500).json({ error: 'Upload failed' })
    }
}
