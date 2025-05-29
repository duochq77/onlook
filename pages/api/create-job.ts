import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export const config = {
    runtime: 'edge',
}

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const body = await req.json()
    const { inputVideo, outputName } = body

    if (!inputVideo || !outputName) {
        return new Response(JSON.stringify({ error: 'Thiếu thông tin đầu vào' }), { status: 400 })
    }

    const job = { inputVideo, outputName }

    await redis.rpush('ffmpeg-jobs:clean', JSON.stringify(job))

    try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`, {
            method: 'POST'
        })
    } catch (err) {
        console.error('⚠️ Không gọi được trigger-jobs:', err)
    }

    return new Response(JSON.stringify({ message: '✅ Đã đẩy job clean và trigger job tự động' }))
}
