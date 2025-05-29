import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import http from 'http'
import https from 'https'

console.log('✂️ Clean Video Worker đã khởi động...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runCleanVideoWorker() {
    while (true) {
        const raw = await redis.lpop('ffmpeg-jobs:clean')
        if (!raw) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        let job
        try {
            job = JSON.parse(raw as string)
        } catch (err) {
            console.error('❌ JSON parse lỗi:', raw)
            continue
        }

        const { inputVideo, outputName } = job
        const inputPath = path.join('/tmp', 'input.mp4')
        const cleanPath = path.join('/tmp', 'clean.mp4')

        try {
            // 🔗 Lấy public URL từ Supabase
            const { data } = supabase.storage.from('stream-files').getPublicUrl(inputVideo)
            const videoUrl = data.publicUrl
            if (!videoUrl) throw new Error('❌ Không có publicUrl của video')

            // ⏬ Tải file video gốc về /tmp/input.mp4
            await downloadFile(videoUrl, inputPath)
        } catch (err) {
            console.error('❌ Lỗi tải video từ Supabase:', err)
            continue
        }

        try {
            // 🧼 Tách video khỏi audio
            const cmd = `ffmpeg -i "${inputPath}" -an -c:v copy "${cleanPath}"`
            await execPromise(cmd)
            console.log('✅ Đã tạo video sạch:', cleanPath)
        } catch (err) {
            console.error('❌ Lỗi FFmpeg khi tách âm thanh:', err)
            continue
        }

        try {
            // ✅ SUY RA đường dẫn audio tương ứng
            const inputAudio = inputVideo
                .replace('input-videos/', 'input-audios/')
                .replace('-video.mp4', '-audio.mp3')

            // 🚀 Đẩy job sang hàng đợi merge
            await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({
                cleanVideoPath: cleanPath,
                inputAudio,
                outputName
            }))

            // 🚨 Kích hoạt trigger tiếp theo
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-jobs`, {
                method: 'POST'
            })

            console.log('✅ Đã đẩy job merge và gọi trigger tiếp theo')
        } catch (err) {
            console.error('❌ Lỗi khi chuyển giao job merge:', err)
            continue
        }
    }
}

function execPromise(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err) => (err ? reject(err) : resolve()))
    })
}

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest)
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
            res.pipe(file)
            file.on('finish', () => file.close(() => resolve()))
        }).on('error', reject)
    })
}

// ✅ HTTP server giữ job sống trên Cloud Run Job (để check trạng thái)
const port = parseInt(process.env.PORT || '8080', 10)
http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ clean-video-worker is alive')
}).listen(port)

runCleanVideoWorker()
