// upload-job.ts
import 'dotenv/config'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({
    outputName: 'demo-final.mp4'
}))

console.log('✅ Đã gửi job upload')
