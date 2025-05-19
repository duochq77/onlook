import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from '@upstash/redis'
import { supabase } from '@/services/SupabaseService'
import { v4 as uuidv4 } from 'uuid'

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb'
        }
    }
}

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { file, filename } = req.body

    if (!file || !filename) {
        return res.status(400).json({ error: 'Thiếu file hoặc filename' })
    }

    try {
        // Upload file gốc lên Supabase
        const fileBuffer = Buffer.from(file, 'base64')
        const outputName = `${uuidv4()}-${filename}`
        const filePath = `tmp/${outputName}`

        const { error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(filePath, fileBuffer, {
                contentType: 'video/mp4',
                upsert: false
            })

        if (error) throw error

        // Đẩy job tách âm vào Redis
        await redis.rpush('ffmpeg-jobs:clean', JSON.stringify({
            inputVideo: filePath,
            outputName
        }))

        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/tmp/${outputName}`

        return res.status(200).json({ success: true, videoUrl: publicUrl, outputName })
    } catch (err: any) {
        console.error('❌ Lỗi upload hoặc Redis:', err)
        return res.status(500).json({ error: 'Lỗi xử lý server' })
    }
}
