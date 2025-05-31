import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import http from 'http'
import https from 'https'

console.log('🟢 [1] Worker khởi động...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runCleanVideoWorker() {
    console.log('🟢 [2] Bắt đầu vòng lặp lấy job từ Redis...')

    while (true) {
        const raw = await redis.lpop('ffmpeg-jobs:clean')
        if (!raw) {
            console.log('🟡 [2.1] Không có job trong Redis, nghỉ 3s...')
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        console.log('🟢 [2.2] Đã lấy được job từ Redis:', raw)

        let job
        try {
            console.log('🟢 [2.4] Đang parse job:', raw);
            job = JSON.parse(raw as string)  // Kiểm tra dữ liệu trước khi parse
        } catch (err) {
            console.error('❌ [2.3] JSON parse lỗi:', raw)
            continue
        }

        const { inputVideo, outputName } = job
        console.log('🟢 [3] Job chi tiết:', inputVideo, outputName)

        const inputPath = path.join('/tmp', 'input.mp4')
        const cleanPath = path.join('/tmp', 'clean.mp4')

        try {
            const { data, error } = supabase.storage.from('stream-files').getPublicUrl(inputVideo)
            const videoUrl = data?.publicUrl
            if (error || !videoUrl) {
                console.error('❌ Không có publicUrl của video', error)
                continue
            }

            console.log('🟢 [4] Bắt đầu tải video từ Supabase...')
            await downloadFile(videoUrl, inputPath)
            console.log('✅ [4.1] Đã tải xong video về:', inputPath)
        } catch (err) {
            console.error('❌ [4.2] Lỗi tải video:', err)
            continue
        }

        try {
            console.log('🟢 [5] Chạy FFmpeg để tách audio...')
            const cmd = `ffmpeg -i "${inputPath}" -an -c:v copy "${cleanPath}"`
            await execPromise(cmd)
            console.log('✅ [5.1] Đã tạo video sạch:', cleanPath)
        } catch (err) {
            console.error('❌ [5.2] FFmpeg lỗi:', err)
            continue
        }

        try {
            const inputAudio = inputVideo
                .replace('input-videos/', 'input-audios/')
                .replace('-video.mp4', '-audio.mp3')

            console.log('🟢 [6] Gửi job MERGE vào Redis...')
            await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({
                cleanVideoPath: cleanPath,
                inputAudio,
                outputName
            }))

            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-merge`, {
                method: 'POST'
            })

            console.log('✅ [6.1] Đã đẩy MERGE job và gọi trigger')
        } catch (err) {
            console.error('❌ [6.2] Lỗi khi trigger merge:', err)
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

const port = parseInt(process.env.PORT || '8080', 10)
http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ clean-video-worker is alive')
}).listen(port)

runCleanVideoWorker()
