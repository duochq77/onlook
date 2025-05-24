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
        if (!fileName) return new Response('fileName is required', { status: 400 })

        const key = `cleanup-after:${fileName}`
        const payload = {
            fileName,
            timestamp: Date.now()
        }

        await redis.set(key, JSON.stringify(payload))

        return new Response('✅ Stop signal received')
    } catch (err) {
        return new Response('❌ Server error', { status: 500 })
    }
}
