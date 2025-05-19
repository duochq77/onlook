// 01. src/pages/api/productFile.ts

import { supabase } from '@/services/SupabaseService'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { fileName, base64Data } = req.body
    if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'Missing fileName or base64Data' })
    }

    try {
        const buffer = Buffer.from(base64Data, 'base64')
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(`product-files/${fileName}`, buffer, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (error) throw error

        const url = supabase.storage.from('uploads').getPublicUrl(`product-files/${fileName}`).data.publicUrl
        return res.status(200).json({ url })
    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Upload failed' })
    }
}
