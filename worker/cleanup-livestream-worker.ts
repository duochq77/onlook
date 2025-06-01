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

async function runCleanupLivestreamWorker() {
    console.log('🧹 Bắt đầu cleanup-livestream-worker...')

    // Lấy toàn bộ key cleanup-after:...
    const keys = await redis.keys('cleanup-after:*')
    console.log(`🔍 Tìm thấy ${keys.length} key cleanup-after`)

    for (const key of keys) {
        const status = await redis.get(key)
        if (status !== 'pending') {
            console.log(`❎ Bỏ qua key ${key} vì đã xử lý hoặc không hợp lệ`)
            continue
        }

        const outputName = key.replace('cleanup-after:', '')
        const path = `outputs/${outputName}`

        // Kiểm tra file có tồn tại không
        const { data: fileStat, error: statError } = await supabase
            .storage
            .from('stream-files')
            .list('outputs', { search: outputName })

        if (statError || !fileStat || fileStat.length === 0) {
            console.warn(`⚠️ File không tồn tại hoặc lỗi đọc: ${outputName}`)
            await redis.del(key)
            continue
        }

        // Xoá file
        const { error: deleteError } = await supabase
            .storage
            .from('stream-files')
            .remove([path])

        if (deleteError) {
            console.error(`❌ Lỗi khi xoá file ${path}:`, deleteError)
        } else {
            console.log(`🗑 Đã xoá file ${path} khỏi Supabase`)
        }

        // Xoá key khỏi Redis
        await redis.del(key)
        console.log(`✅ Đã xoá Redis key: ${key}`)
    }

    console.log('🎉 cleanup-livestream-worker hoàn tất.')
}

runCleanupLivestreamWorker().catch((err) => {
    console.error('❌ Lỗi tổng thể cleanup-livestream-worker:', err)
})
