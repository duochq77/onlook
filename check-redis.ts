// check-redis.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: 'https://clean-humpback-36746.upstash.io',
    token: 'AY-KAAIjcDE4MGM4Y2JjYzNmNGM0YjBhYjIwMGUwOGUwN2U0NTA5MHAxMA',
})

async function check() {
    const value = await redis.lrange('ffmpeg-jobs:clean', 0, -1)
    console.log('📦 Job trong queue:', value)
}

check()
