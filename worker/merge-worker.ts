import 'dotenv/config'
import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

async function runMergeWorker() {
    console.log('🎬 Merge Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:merge')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const { videoFile, audioFile, outputName } = JSON.parse(job)

            const videoPath = path.join('/tmp', videoFile)
            const audioPath = path.join('/tmp', audioFile)
            const mergedPath = path.join('/tmp', outputName)

            // Kiểm tra file tồn tại
            if (!fs.existsSync(videoPath)) throw new Error(`❌ Không tìm thấy video: ${videoPath}`)
            if (!fs.existsSync(audioPath)) throw new Error(`❌ Không tìm thấy audio: ${audioPath}`)

            const command = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac "${mergedPath}"`
            console.log('🔧 Ghép video + audio:', command)
            await execPromise(command)

            console.log(`✅ Đã tạo merged file: ${outputName}`)

            // Đẩy sang hàng upload
            await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName }))

            // Đẩy sang hàng cleanup (xoá file tạm và gốc)
            await redis.rpush('ffmpeg-jobs:cleanup', JSON.stringify({
                deleteType: 'origin',
                originFiles: [videoFile, audioFile],
                outputName
            }))
        } catch (err) {
            console.error('❌ Lỗi khi merge:', err)
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

runMergeWorker()
