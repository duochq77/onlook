import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function runCleanVideoWorker() {
    console.log('✂️ Clean Video Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:clean')
        if (!job) {
            await new Promise((r) => setTimeout(r, 1000))
            continue
        }

        try {
            const { inputVideo, outputName } = JSON.parse(job)
            const inputPath = inputVideo.startsWith('/tmp') ? inputVideo : path.join('/tmp', inputVideo)
            const cleanOutput = path.join('/tmp', `clean-${outputName}`)

            const command = `ffmpeg -i "${inputPath}" -c copy -an "${cleanOutput}"`
            console.log('🔧 Đang tách âm thanh:', command)

            await execPromise(command)
            console.log(`✅ Đã tách xong: clean-${outputName}`)

            await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName: `clean-${outputName}` }))

            // 🧹 Gửi job xoá file gốc và tạm
            await redis.rpush('ffmpeg-jobs:cleanup', JSON.stringify({
                deleteType: 'origin',
                outputName: `clean-${outputName}`,
                originFiles: [inputVideo]
            }))

        } catch (err) {
            console.error('❌ Lỗi xử lý clean-video:', err)
        }
    }
}

function execPromise(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}

runCleanVideoWorker()
