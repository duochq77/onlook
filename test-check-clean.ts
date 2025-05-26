// test-check-clean.ts
import 'dotenv/config'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

async function checkQueue() {
    const jobs = await redis.lrange('ffmpeg-jobs:clean', 0, -1)
    console.log('📦 Job queue ffmpeg-jobs:clean:', jobs)
}

checkQueue()
