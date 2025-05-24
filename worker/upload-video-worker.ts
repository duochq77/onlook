// worker/upload-video-worker.ts

import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runUploadWorker() {
    console.log('☁️ Upload Worker đã khởi động...')
    console.log('🌐 ENV.SUPABASE_URL:', process.env.SUPABASE_URL)

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:upload')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const { outputName } = JSON.parse(job)
            const filePath = path.join('/tmp', outputName)

            console.log(`📤 Đang upload: ${outputName}`)

            const fileBuffer = fs.readFileSync(filePath)
            const { data, error } = await supabase
                .storage
                .from('uploads')
                .upload(`outputs/${outputName}`, fileBuffer, {
                    contentType: 'video/mp4',
                    upsert: true
                })

            if (error) throw error
            console.log('✅ Upload thành công:', data?.path)
        } catch (err) {
            console.error('❌ Lỗi upload:', err)
        }
    }
}

runUploadWorker()
