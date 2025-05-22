import 'dotenv/config'
import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function runUploadWorker() {
    console.log('📦 Upload Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:upload')
        if (!job) {
            await new Promise((r) => setTimeout(r, 2000))
            continue
        }

        try {
            const { outputName } = JSON.parse(job)
            const filePath = path.join('/tmp', outputName)

            if (!fs.existsSync(filePath)) {
                console.warn('⚠️ File không tồn tại:', filePath)
                continue
            }

            const fileBuffer = fs.readFileSync(filePath)

            const { error } = await supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET!)
                .upload(`outputs/${outputName}`, fileBuffer, {
                    contentType: 'video/mp4',
                    upsert: true
                })

            if (error) {
                console.error('❌ Lỗi upload lên Supabase:', error)
                continue
            }

            console.log(`✅ Upload thành công: outputs/${outputName}`)

            // Xoá file local sau khi upload
            fs.unlinkSync(filePath)
            console.log(`🧹 Đã xoá file local: ${filePath}`)
        } catch (err) {
            console.error('❌ Lỗi upload-worker:', err)
        }
    }
}

runUploadWorker()
