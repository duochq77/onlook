require('dotenv').config()
const { Redis } = require('@upstash/redis')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function check() {
    const job = await redis.lrange('ffmpeg-jobs:clean', 0, -1)
    console.log('📋 Danh sách job:', job)
}

check()
