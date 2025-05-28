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
        console.log('🧪 Đang đọc Redis queue...')
        const raw = await redis.lpop('ffmpeg-jobs:clean')
        if (!raw) {
            console.log('🚫 Không tìm thấy job trong Redis.')
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
            const { data } = supabase.storage.from('stream-files').getPublicUrl(inputVideo)
            const url = data.publicUrl
            if (!url) throw new Error('❌ Không có publicUrl từ Supabase')
            await downloadFile(url, inputPath)

            if (!fs.existsSync(inputPath)) {
                throw new Error('❌ File tải về không tồn tại')
            }

            console.log('✅ Tải video thành công:', inputPath)
        } catch (err) {
            console.error('❌ Lỗi tải video:', err)
            continue
        }

        try {
            console.log('🎬 FFmpeg đang xử lý...')
            const cmd = `ffmpeg -i "${inputPath}" -an -c:v copy "${cleanPath}"`
            await execPromise(cmd)
            console.log('✅ Đã tạo video sạch:', cleanPath)
        } catch (err) {
            console.error('❌ Lỗi FFmpeg:', err)
            continue
        }

        try {
            const cleanFileName = inputVideo
                .replace('input-videos/', 'clean/')
                .replace('-video.mp4', '-clean.mp4')

            const cleanBuffer = fs.readFileSync(cleanPath)
            await supabase.storage
                .from('stream-files')
                .upload(cleanFileName, cleanBuffer, {
                    contentType: 'video/mp4',
                    upsert: true
                })

            console.log('✅ Upload video sạch thành công:', cleanFileName)
            // ✅ Dừng lại tại đây — chưa đẩy sang merge
        } catch (err) {
            console.error('❌ Upload video sạch thất bại:', err)
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
