import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'

// Khởi tạo Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Khởi tạo Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function runUploadWorker() {
    console.log('📤 Upload Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:upload')
        if (!job) {
            await new Promise((r) => setTimeout(r, 1000))
            continue
        }

        try {
            const { outputName } = JSON.parse(job)
            const filePath = path.join('/tmp', outputName)

            if (!fs.existsSync(filePath)) {
                console.error(`❌ Không tìm thấy file: ${filePath}`)
                continue
            }

            const fileData = fs.readFileSync(filePath)
            const { error } = await supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET!)
                .upload(`outputs/${outputName}`, fileData, {
                    contentType: 'video/mp4',
                    upsert: true
                })

            if (error) throw error

            console.log(`✅ Đã upload: ${outputName}`)
            fs.unlinkSync(filePath)
        } catch (err) {
            console.error('❌ Lỗi upload file:', err)
        }
    }
}

runUploadWorker()
