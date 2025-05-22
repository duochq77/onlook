import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
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
            const inputPath = path.join('/tmp', inputVideo)
            const cleanOutput = path.join('/tmp', outputName)

            const command = `ffmpeg -i "${inputPath}" -c copy -an "${cleanOutput}"`
            console.log('🔧 Tách âm thanh:', command)
            await execPromise(command)

            console.log(`✅ Đã tạo video sạch: ${outputName}`)

            // Đẩy sang hàng đợi merge tiếp theo
            // (merge job sẽ do API /api/merge-upload tạo sau)
        } catch (err) {
            console.error('❌ Lỗi clean video:', err)
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
