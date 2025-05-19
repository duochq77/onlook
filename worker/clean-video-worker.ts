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
            // Đảm bảo inputVideo là đường dẫn đầy đủ trong /tmp hoặc chuẩn hóa thành đường dẫn trong /tmp
            const inputPath = inputVideo.startsWith('/tmp') ? inputVideo : path.join('/tmp', inputVideo)
            const cleanOutput = path.join('/tmp', `clean-${outputName}`)

            // Lệnh tách âm thanh: giữ video sạch, bỏ âm thanh
            const command = `ffmpeg -i "${inputPath}" -c copy -an "${cleanOutput}"`
            console.log('🔧 Đang tách âm:', command)

            await execPromise(command)

            console.log(`✅ Đã tách âm thành công: clean-${outputName}`)

            // Đẩy job sang queue upload nếu cần (tùy luồng xử lý)
            await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName: `clean-${outputName}` }))

            // Xóa file gốc nếu muốn (có thể tùy chỉnh)
            // if (fs.existsSync(inputPath)) {
            //     fs.unlinkSync(inputPath)
            //     console.log(`🗑️ Đã xoá file gốc: ${inputPath}`)
            // }
        } catch (err) {
            console.error('❌ Lỗi tách âm:', err)
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
