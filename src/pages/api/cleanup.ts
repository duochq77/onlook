import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/services/SupabaseService'
import fs from 'fs'
import path from 'path'

/**
 * API này xoá toàn bộ file trong thư mục `outputs/[userId]/`
 * Có thể gọi sau khi seller dừng livestream
 * @route DELETE /api/cleanup?user=abc123
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

    const { user } = req.query
    if (!user || typeof user !== 'string') {
        return res.status(400).json({ error: 'Missing user ID' })
    }

    const prefix = `outputs/${user}/`
    const { data: files, error: listError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .list(prefix, { limit: 100 })

    if (listError) {
        return res.status(500).json({ error: 'Failed to list files' })
    }

    const filePaths = files.map((f) => `${prefix}${f.name}`)
    const { error: deleteError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .remove(filePaths)

    if (deleteError) {
        return res.status(500).json({ error: 'Failed to delete files' })
    }

    return res.status(200).json({ message: `Đã xoá ${filePaths.length} file cho user ${user}` })
}
