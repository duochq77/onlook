import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

// Khởi tạo Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Khởi tạo Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Hàm chạy worker xử lý job từ hàng đợi Redis
export async function runWorker() {
    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs')

        if (!job) {
            await new Promise((r) => setTimeout(r, 1000)) // chờ 1 giây rồi kiểm tra lại
            continue
        }

        try {
            const { inputVideo, inputAudio, outputName } = JSON.parse(job)
            const outputPath = path.join('/tmp', outputName)

            const command = `ffmpeg -i ${inputVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputPath}`
            await execPromise(command)

            const data = fs.readFileSync(outputPath)
            await supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET!)
                .upload(`outputs/${outputName}`, data, {
                    contentType: 'video/mp4',
                    upsert: true,
                })

            fs.unlinkSync(outputPath)
            console.log(`✅ Xử lý xong: ${outputName}`)
        } catch (err) {
            console.error('❌ Xử lý job thất bại:', err)
        }
    }
}

// Hàm hỗ trợ chạy lệnh shell với Promise
function execPromise(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}
