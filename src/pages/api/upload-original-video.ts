import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/services/SupabaseService'
import { v4 as uuidv4 } from 'uuid'

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '500mb'
        }
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { file, filename } = req.body

    if (!file || !filename) {
        return res.status(400).json({ error: 'Missing file or filename' })
    }

    const fileBuffer = Buffer.from(file, 'base64')
    const filePath = `original/${uuidv4()}-${filename}`

    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .upload(filePath, fileBuffer, {
            contentType: 'video/mp4',
            upsert: false,
        })

    if (error) return res.status(500).json({ error: error.message })

    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/${filePath}`
    res.status(200).json({ url: fileUrl, path: filePath })
}
