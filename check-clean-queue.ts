import 'dotenv/config'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function main() {
    const jobs = await redis.lrange('ffmpeg-jobs:clean', 0, -1)
    console.log('🧼 CLEAN queue:', jobs.map((j) => JSON.parse(j)))
}

main()
