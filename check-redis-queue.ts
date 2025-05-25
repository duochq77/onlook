// check-redis-queue.ts

import 'dotenv/config'
import { Redis } from '@upstash/redis'

// Khởi tạo kết nối Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

async function checkQueue() {
    const jobs = await redis.lrange('ffmpeg-jobs:upload', 0, -1)
    console.log('📋 Danh sách job đang chờ upload:', jobs)
}

checkQueue()
