import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function runMergeWorker() {
    console.log('🎬 Merge Worker đã khởi động...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:merge')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000)) // nghỉ 3s nếu chưa có job
            continue
        }

        try {
            const { video, audio, outputName } = JSON.parse(job)

            const videoPath = path.join('/tmp', video)
            const audioPath = path.join('/tmp', audio)
            const mergedPath = path.join('/tmp', outputName)

            // Kiểm tra file tồn tại
            if (!fs.existsSync(videoPath)) {
                throw new Error(`❌ File video không tồn tại: ${videoPath}`)
            }
            if (!fs.existsSync(audioPath)) {
                throw new Error(`❌ File audio không tồn tại: ${audioPath}`)
            }

            const command = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental "${mergedPath}"`
            console.log('🔧 Ghép video + audio:', command)

            await execPromise(command)

            console.log(`✅ Đã tạo merged file: ${outputName}`)

            // Đẩy sang hàng chờ upload
            await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName }))

            // Đẩy thêm job dọn file gốc
            await redis.rpush('ffmpeg-jobs:cleanup', JSON.stringify({
                deleteType: 'origin',
                originFiles: [video, audio],
                outputName,
            }))

        } catch (err) {
            console.error('❌ Lỗi merge video + audio:', err)
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
