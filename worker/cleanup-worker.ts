import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function runCleanupWorker() {
    console.log('🧹 Cleanup Worker bắt đầu...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:cleanup')
        if (!job) {
            await new Promise((r) => setTimeout(r, 2000))
            continue
        }

        const { inputVideo, inputAudio } = JSON.parse(job)
        console.log('📦 Nhận job CLEANUP:', { inputVideo, inputAudio })

        // 1. Xoá file video gốc trên Supabase
        if (inputVideo) {
            const { error } = await supabase.storage.from('stream-files').remove([inputVideo])
            if (error) console.warn('⚠️ Không thể xoá inputVideo:', inputVideo, error)
            else console.log('🗑 Đã xoá inputVideo:', inputVideo)
        }

        // 2. Xoá file audio gốc trên Supabase
        if (inputAudio) {
            const { error } = await supabase.storage.from('stream-files').remove([inputAudio])
            if (error) console.warn('⚠️ Không thể xoá inputAudio:', inputAudio, error)
            else console.log('🗑 Đã xoá inputAudio:', inputAudio)
        }

        console.log('✅ Cleanup hoàn tất (2 file gốc)')
    }
}

runCleanupWorker().catch((err) => console.error('❌ Worker gặp lỗi:', err))
