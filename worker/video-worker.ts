import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

// Khởi tạo Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Hàm xử lý job ghép video
async function runVideoWorker() {
    console.log('🎬 Video Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:video')
        if (!job) {
            await new Promise((r) => setTimeout(r, 1000))
            continue
        }

        try {
            const { inputVideo, inputAudio, outputName } = JSON.parse(job)
            const outputPath = path.join('/tmp', outputName)

            const command = `ffmpeg -i "${inputVideo}" -i "${inputAudio}" -c:v copy -c:a aac -shortest "${outputPath}"`
            console.log('🚀 Đang ghép video/audio:', command)

            await execPromise(command)
            console.log(`✅ Đã tạo file: ${outputPath}`)

            // Đẩy tên file sang upload queue
            await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName }))
        } catch (err) {
            console.error('❌ Lỗi khi xử lý video job:', err)
        }
    }
}

// Helper chạy shell command
function execPromise(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}

runVideoWorker()
