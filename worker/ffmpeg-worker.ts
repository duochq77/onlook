import 'dotenv/config'
console.log("🧪 ENV CHECK: ", {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    BUCKET: process.env.SUPABASE_STORAGE_BUCKET
})
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

// Worker xử lý job video/audio từ Redis Queue
export async function runWorker() {
    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs')
        if (!job) {
            await new Promise((r) => setTimeout(r, 1000)) // nghỉ 1 giây rồi kiểm tra tiếp
            continue
        }

        try {
            const { inputVideo, inputAudio, outputName } = JSON.parse(job)
            const outputPath = path.join('/tmp', outputName)

            // Tạo lệnh ffmpeg
            const command = `ffmpeg -i "${inputVideo}" -i "${inputAudio}" -c:v copy -c:a aac -shortest "${outputPath}"`
            console.log('🚀 Đang xử lý:', command)
            await execPromise(command)

            // Đọc file output và upload lên Supabase Storage
            const data = fs.readFileSync(outputPath)
            const { error } = await supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET!)
                .upload(`outputs/${outputName}`, data, {
                    contentType: 'video/mp4',
                    upsert: true,
                })

            if (error) throw error

            // Xóa file tạm sau khi upload
            fs.unlinkSync(outputPath)
            console.log(`✅ Đã xử lý xong: ${outputName}`)
        } catch (err) {
            console.error('❌ Lỗi xử lý job:', err)
        }
    }
}

// Chạy command shell dưới dạng Promise
function execPromise(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}
