import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'

console.log('🔀 Merge Worker đã khởi động...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runMergeWorker() {
    while (true) {
        const raw = await redis.lpop('ffmpeg-jobs:merge')
        if (!raw) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const { cleanVideoPath, inputAudio, outputName } = JSON.parse(raw as string)

            const audioPath = path.join('/tmp', 'audio.mp3')
            const mergedPath = path.join('/tmp', outputName)

            // ✅ Tải file audio từ Supabase
            const { data: audioData } = supabase.storage.from('stream-files').getPublicUrl(inputAudio)
            const audioUrl = audioData.publicUrl
            if (!audioUrl) throw new Error(`❌ Không lấy được publicUrl của audio: ${inputAudio}`)

            console.log('⏬ Tải audio từ Supabase:', audioUrl)
            await downloadFile(audioUrl, audioPath)

            // 🎬 Ghép clean.mp4 và audio.mp3 → tạo merged.mp4
            const cmd = `ffmpeg -y -i "${cleanVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${mergedPath}"`
            console.log('🎬 Chạy FFmpeg:', cmd)
            await execPromise(cmd)

            console.log('✅ Đã tạo xong merged file:', mergedPath)

            // ✅ Upload merged file lên Supabase
            const mergedBuffer = fs.readFileSync(mergedPath)
            await supabase.storage
                .from('stream-files')
                .upload(`outputs/${outputName}`, mergedBuffer, {
                    contentType: 'video/mp4',
                    upsert: true
                })

            console.log(`📤 Đã upload lên Supabase: outputs/${outputName}`)

            // ✅ Gửi job upload xong (nếu cần signal)
            // await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName }))

        } catch (err) {
            console.error('❌ Lỗi khi merge hoặc upload:', err)
        }
    }
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

function execPromise(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err) => (err ? reject(err) : resolve()))
    })
}

// ✅ HTTP server giữ job sống trên Cloud Run
const port = parseInt(process.env.PORT || '8080', 10)
http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ merge-video-worker is alive')
}).listen(port)

runMergeWorker()
