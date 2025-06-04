import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import util from 'util'

const execPromise = util.promisify(exec)

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ Đã sửa chỗ này
)

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function runWorker() {
    console.log('🎬 CLEAN Video Worker đang chạy...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:clean')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const { inputVideo, outputName } = JSON.parse(job)
            console.log('📥 Nhận job CLEAN:', inputVideo)

            const tmpInputPath = path.join('/tmp', 'input.mp4')
            const tmpOutputPath = path.join('/tmp', `${outputName}-clean.mp4`)

            // 🧲 Tải video từ Supabase
            const { data, error } = await supabase
                .storage
                .from(process.env.SUPABASE_STORAGE_BUCKET!)
                .download(inputVideo)

            if (error || !data) {
                console.error('❌ Lỗi tải video từ Supabase:', error)
                continue
            }

            const fileBuffer = await data.arrayBuffer()
            fs.writeFileSync(tmpInputPath, Buffer.from(fileBuffer))

            // ✂️ Tách audio khỏi video
            const cmd = `ffmpeg -y -i ${tmpInputPath} -an -c:v copy ${tmpOutputPath}`
            console.log('⚙️ Chạy FFmpeg:', cmd)
            await execPromise(cmd)

            console.log('✅ Đã tạo video sạch:', tmpOutputPath)

            // 📤 Gọi API /api/merge-job.ts
            const siteURL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
            if (!siteURL) {
                throw new Error('SITE_URL chưa được cấu hình trong biến môi trường')
            }

            const res = await fetch(`${siteURL}/api/merge-job`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cleanVideoPath: tmpOutputPath,
                    originalAudioPath: inputVideo.replace('input-videos/', 'input-audios/').replace('.mp4', '.mp3'),
                    outputName,
                }),
            })

            if (!res.ok) {
                const errorText = await res.text()
                console.warn('⚠️ Gọi merge-job thất bại:', errorText)
            } else {
                console.log('🚀 Đã gọi API merge-job thành công')
            }
        } catch (err) {
            console.error('💥 Lỗi xử lý CLEAN:', err)
        }
    }
}

runWorker().catch(console.error)
