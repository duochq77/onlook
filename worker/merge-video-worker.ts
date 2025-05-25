import 'dotenv/config'
import { Redis } from '@upstash/redis'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import https from 'https'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runMergeWorker() {
    console.log('🔀 Merge Worker đã khởi động...')
    console.log('🌐 Kiểm tra ENV:', process.env.SUPABASE_URL)

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:merge')
        if (!job) {
            await new Promise((r) => setTimeout(r, 3000))
            continue
        }

        try {
            const jobData = JSON.parse(job)
            console.log('📥 Nhận job:', jobData)

            const { cleanVideo, inputAudio, outputName } = jobData

            const videoPath = path.join('/tmp', cleanVideo)
            const audioPath = path.join('/tmp', 'audio.mp3')
            const outputPath = path.join('/tmp', outputName)

            // ✅ Dùng bucket mới: stream-files
            const result = supabase.storage
                .from('stream-files')
                .getPublicUrl(inputAudio.replace(/^stream-files\//, ''))

            const publicAudioUrl = result.data.publicUrl
            if (!publicAudioUrl) throw new Error('❌ Không lấy được publicUrl audio')

            console.time('⏳ Tải audio')
            await downloadFile(publicAudioUrl, audioPath)
            console.timeEnd('⏳ Tải audio')

            const command = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c copy -shortest "${outputPath}"`
            console.log('🎬 FFmpeg merge:', command)

            console.time('🎬 FFmpeg merge xử lý')
            await execPromise(command)
            console.timeEnd('🎬 FFmpeg merge xử lý')

            console.log(`✅ Đã ghép thành công: ${outputName}`)

            await redis.rpush('ffmpeg-jobs:upload', JSON.stringify({ outputName }))
        } catch (err) {
            console.error('❌ Lỗi merge:', err)
        }
    }
}

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        const file = fs.createWriteStream(dest)

        const request = https.get(url, (response) => {
            if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`))

            response.pipe(file)

            file.on('finish', () => {
                file.close(() => {
                    const size = fs.statSync(dest).size
                    if (size < 1000) {
                        reject(new Error(`⚠️ File audio quá nhỏ (${size} bytes)`))
                    } else {
                        resolve()
                    }
                })
            })

            file.on('error', reject)
        })

        request.setTimeout(15000, () => {
            request.abort()
            reject(new Error('⏰ Timeout tải file audio'))
        })

        request.on('error', reject)
    })
}

function execPromise(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}

runMergeWorker()
