// test-job.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: 'https://clean-humpback-36746.upstash.io',
    token: 'AY-KAAIjcDE4MGM4Y2JjYzNmNGM0YjBhYjIwMGUwOGUwN2U0NTA5MHAxMA',
})

async function pushJob() {
    const timestamp = 1748361891023 // ✅ Bạn có thể thay bằng Date.now() nếu muốn dynamic
    const inputVideo = `input-videos/${timestamp}-video.mp4`
    const outputName = `${timestamp}-merged.mp4`

    const job = {
        inputVideo,
        outputName
    }

    await redis.rpush('ffmpeg-jobs:clean', JSON.stringify(job))
    console.log('✅ Đã đẩy job vào Redis: ffmpeg-jobs:clean', job)
}

pushJob().catch(console.error)
