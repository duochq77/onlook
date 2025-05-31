import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import http from 'http'
import https from 'https'

console.log('✂️ Clean Video Worker đã khởi động...')

// Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

// Supabase
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

        await redis.set(`debug:clean:raw:${Date.now()}`, raw, { ex: 600 })

        let job
        try {
            job = JSON.parse(raw as string)
        } catch (err) {
            console.error('❌ JSON parse lỗi:', raw)
            await redis.set(`debug:clean:error:parse:${Date.now()}`, String(err), { ex: 600 })
            continue
        }

        const { inputVideo, outputName } = job
        const inputPath = path.join('/tmp', 'input.mp4')
        const cleanPath = path.join('/tmp', 'clean.mp4')

        try {
            const { data } = supabase.storage.from('stream-files').getPublicUrl(inputVideo)
            const videoUrl = data.publicUrl
            if (!videoUrl) throw new Error('❌ Không có publicUrl của video')

            await redis.set(`debug:clean:url:${outputName}`, videoUrl, { ex: 600 })

            await downloadFile(videoUrl, inputPath)
            await redis.set(`debug:clean:downloaded:${outputName}`, Date.now(), { ex: 600 })
        } catch (err) {
            console.error('❌ Lỗi tải video từ Supabase:', err)
            await redis.set(`debug:clean:error:download:${outputName}`, String(err), { ex: 600 })
            continue
        }

        try {
            const cmd = `ffmpeg -i "${inputPath}" -an -c:v copy "${cleanPath}"`
            await execPromise(cmd)
            console.log('✅ Đã tạo video sạch:', cleanPath)
            await redis.set(`debug:clean:ffmpeg:${outputName}`, Date.now(), { ex: 600 })
        } catch (err) {
            console.error('❌ Lỗi FFmpeg khi tách âm thanh:', err)
            await redis.set(`debug:clean:error:ffmpeg:${outputName}`, String(err), { ex: 600 })
            continue
        }

        try {
            const inputAudio = inputVideo
                .replace('input-videos/', 'input-audios/')
                .replace('-video.mp4', '-audio.mp3')

            await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({
                cleanVideoPath: cleanPath,
                inputAudio,
                outputName
            }))
            await redis.set(`debug:clean:pushed-merge:${outputName}`, Date.now(), { ex: 600 })

            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trigger-merge`, {
                method: 'POST'
            })
            console.log('✅ Đã đẩy job merge và gọi trigger-merge')
        } catch (err) {
            console.error('❌ Lỗi khi đẩy job merge:', err)
            await redis.set(`debug:clean:error:merge:${outputName}`, String(err), { ex: 600 })
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

// HTTP Server giữ Job sống trên Cloud Run Job
const port = parseInt(process.env.PORT || '8080', 10)
http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ clean-video-worker is alive')
}).listen(port)

runCleanVideoWorker()
