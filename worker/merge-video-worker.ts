import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import https from 'https'
import http from 'http'

console.log('🎬 Merge Video Worker khởi động...')

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runMergeVideoWorker() {
    while (true) {
        const raw = await redis.lpop('ffmpeg-jobs:merge')
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

        const { cleanVideoPath, inputAudio, outputName } = job
        const audioPath = path.join('/tmp', 'audio.mp3')
        const outputPath = path.join('/tmp', outputName)

        try {
            const { data } = supabase.storage.from('stream-files').getPublicUrl(inputAudio)
            const audioUrl = data.publicUrl
            if (!audioUrl) throw new Error('Không lấy được public URL của audio')
            await downloadFile(audioUrl, audioPath)
        } catch (err) {
            console.error('❌ Lỗi tải audio:', err)
            continue
        }

        try {
            const cmd = `ffmpeg -i "${cleanVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental "${outputPath}"`
            await execPromise(cmd)
            console.log('✅ Đã merge xong:', outputPath)
        } catch (err) {
            console.error('❌ Lỗi FFmpeg khi ghép video + audio:', err)
            continue
        }

        try {
            const fileBuffer = fs.readFileSync(outputPath)
            const { error } = await supabase
                .storage
                .from('stream-files')
                .upload(`outputs/${outputName}`, fileBuffer, {
                    contentType: 'video/mp4',
                    upsert: true
                })

            if (error) throw error

            console.log('✅ Đã upload merged.mp4 lên Supabase')
        } catch (err) {
            console.error('❌ Lỗi khi upload merged.mp4:', err)
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

// HTTP server giữ job sống trên Cloud Run Job
const port = parseInt(process.env.PORT || '8080', 10)
http.createServer((_, res) => {
    res.writeHead(200)
    res.end('✅ merge-video-worker is alive')
}).listen(port)

runMergeVideoWorker()
