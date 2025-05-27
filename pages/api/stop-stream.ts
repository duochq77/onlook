import { Redis } from '@upstash/redis'

export const config = {
    runtime: 'edge'
}

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    try {
        const { fileName } = await req.json()
        if (!fileName || typeof fileName !== 'string') {
            return new Response('❌ Thiếu hoặc sai định dạng fileName', { status: 400 })
        }

        const redisKey = `cleanup-after:${fileName}`
        const payload = {
            fileName,
            timestamp: Date.now()
        }

        await redis.set(redisKey, JSON.stringify(payload))
        console.log('🛑 Đã ghi key cleanup sau stream:', redisKey)

        return new Response('✅ Stop signal received')
    } catch (err) {
        console.error('❌ Lỗi stop-stream:', err)
        return new Response('❌ Server error', { status: 500 })
    }
}
