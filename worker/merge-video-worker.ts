import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import http from 'http'
import https from 'https'

console.log('🔀 Merge Video Worker khởi động...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    while (true) {
        console.log('📦 Đang đọc Redis queue...')
        const raw = await redis.lpop('ffmpeg-jobs:merge')
        if (!raw) {
            console.log('⏳ Không có job merge.')
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

        const { cleanVideo, inputAudio, outputName } = job
        console.log('✅ Nhận job merge:', job)

        const videoPath = path.join('/tmp', 'clean.mp4')
        const audioPath = path.join('/tmp', 'audio.mp3')
        const mergedPath = path.join('/tmp', 'merged.mp4')

        // Tải video sạch
        try {
            console.log('⏬ Tải clean video...')
            const { data } = supabase.storage.from('stream-files').getPublicUrl(cleanVideo)
            const url = data.publicUrl
            if (!url) throw new Error('Không có URL clean video')
            await downloadFile(url, videoPath)
        } catch (err) {
            console.error('❌ Lỗi tải clean video:', err)
            continue
        }

        // Tải audio
        try {
            console.log('⏬ Tải audio...')
            const { data } = supabase.storage.from('stream-files').getPublicUrl(inputAudio)
            const url = data.publicUrl
            if (!url) throw new Error('Không có URL audio')
            await downloadFile(url, audioPath)
        } catch (err) {
            console.error('❌ Lỗi tải audio:', err)
            continue
        }

        // Ghép video + audio
        try {
            console.log('🎬 Ghép video + audio...')
            const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${mergedPath}"`
            await execPromise(cmd)
            console.log('✅ Merge thành công:', mergedPath)
        } catch (err) {
            console.error('❌ Lỗi ghép media:', err)
            continue
        }

        // Upload file merge lên Supabase
        try {
            console.log('📤 Upload merged.mp4...')
            const mergedBuffer = fs.readFileSync(mergedPath)
            await supabase.storage
                .from('stream-files')
                .upload(`outputs/${outputName}`, mergedBuffer, {
                    contentType: 'video/mp4',
                    upsert: true
                })
            console.log('✅ Upload merged.mp4 thành công:', outputName)
        } catch (err) {
            console.error('❌ Upload lỗi:', err)
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
    res.end('✅ merge-video-worker is alive')
}).listen(port)

run()
