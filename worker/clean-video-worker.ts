import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import http from 'http'
import https from 'https'

console.log('✂️ Clean Video Worker starting...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runCleanVideoWorker() {
    console.log('✅ Clean Video Worker is running...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:clean')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const { inputVideo, outputName } = JSON.parse(job)

            const timestamp = inputVideo.match(/input\/(\d+)-video\.mp4/)?.[1]
            if (!timestamp) throw new Error('❌ Không tìm được timestamp từ tên video')

            const inputAudio = `input/${timestamp}-audio.mp3`
            console.log('📥 Nhận job:', { inputVideo, inputAudio, outputName })

            const { data } = supabase.storage.from('stream-files').getPublicUrl(inputVideo)
            const videoUrl = data.publicUrl
            if (!videoUrl) throw new Error('❌ Không lấy được URL video')

            const localInput = `/tmp/${path.basename(inputVideo)}`
            const cleanOutput = `/tmp/${outputName}`

            await downloadFile(videoUrl, localInput)

            const ffmpegCmd = `ffmpeg -y -i "${localInput}" -c copy -an "${cleanOutput}"`
            console.log('🎬 Chạy FFmpeg:', ffmpegCmd)
            await execPromise(ffmpegCmd)

            console.log('✅ Đã tạo xong video sạch')

            await redis.rpush('ffmpeg-jobs:merge', JSON.stringify({
                cleanVideo: outputName,
                inputAudio,
                outputName
            }))
        } catch (err) {
            console.error('❌ Lỗi clean video:', err)
        }
    }
}

http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ Clean-video-worker is alive')
}).listen(process.env.PORT || 8080)

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        const file = fs.createWriteStream(dest)
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
            res.pipe(file)
            file.on('finish', () => file.close(resolve))
        })
        req.on('error', reject)
        req.setTimeout(15000, () => {
            req.destroy()
            reject(new Error('⏰ Timeout tải file'))
        })
    })
}

function execPromise(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err) => (err ? reject(err) : resolve()))
    })
}

runCleanVideoWorker()
