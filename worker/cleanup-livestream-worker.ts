import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import http from 'http'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runCleanupWorker() {
    console.log('🧹 Cleanup Livestream Worker started...')

    while (true) {
        try {
            const keys = await redis.keys('cleanup-after:*')

            for (const key of keys) {
                const value = await redis.get<string>(key)
                if (!value) continue

                const { fileName, timestamp } = JSON.parse(value)
                const now = Date.now()

                // ✅ Thời gian giữ file là 10 phút
                if (now - timestamp >= 10 * 60 * 1000) {
                    console.log(`🗑️ Đã đủ 10 phút — xoá file: ${fileName}`)

                    const path = `outputs/${fileName}`
                    const { error } = await supabase.storage.from('stream-files').remove([path])

                    if (error) {
                        console.error('❌ Lỗi xoá file:', error)
                    } else {
                        console.log(`✅ Đã xoá file khỏi Supabase: ${path}`)
                        await redis.del(key)
                    }
                }
            }
        } catch (err) {
            console.error('❌ Lỗi trong cleanup livestream worker:', err)
        }

        await new Promise((res) => setTimeout(res, 10_000)) // nghỉ 10 giây
    }
}

runCleanupWorker()

// ✅ Dummy HTTP server giữ tiến trình sống
const port = process.env.PORT || 8080
http
    .createServer((_, res) => {
        res.writeHead(200)
        res.end('🧹 Cleanup livestream worker is running')
    })
    .listen(port, () => {
        console.log(`✅ Dummy server is listening on port ${port}`)
    })
