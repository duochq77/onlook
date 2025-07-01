import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { outputName } = req.query

    if (!outputName || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Thiếu hoặc sai định dạng outputName' })
    }

    const path = `outputs/${outputName}`
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).publicUrl

    try {
        await axios.head(publicUrl)
        return res.status(200).json({ exists: true })
    } catch (err) {
        return res.status(200).json({ exists: false })
    }
}
