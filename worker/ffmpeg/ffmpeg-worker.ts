import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'

// --- CẤU HÌNH BẮT BUỘC ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL!
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'videos'

// --- KẾT NỐI DỊCH VỤ ---
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN })

// --- VÒNG LẶP WORKER ---
export async function runWorker() {
    console.log('🎯 Worker khởi động, đang chờ job từ Redis...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:video')
        if (!job) {
            await wait(1000)
            continue
        }

        console.log('📦 Job nhận được:', job)

        try {
            const { inputVideo, inputAudio, outputName } = JSON.parse(job)

            const tmpVideoPath = path.join('/tmp', `video-${Date.now()}.mp4`)
            const tmpAudioPath = path.join('/tmp', `audio-${Date.now()}.mp3`)
            const outputPath = path.join('/tmp', `output-${outputName}`)

            // --- TẢI FILE ---
            await downloadFile(inputVideo, tmpVideoPath)
            await downloadFile(inputAudio, tmpAudioPath)

            // --- CHẠY FFmpeg ---
            const command = `ffmpeg -i "${tmpVideoPath}" -i "${tmpAudioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`
            console.log('🎬 Đang ghép bằng FFmpeg:', command)
            await execPromise(command)

            // --- UPLOAD ---
            const fileBuffer = fs.readFileSync(outputPath)
            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(`outputs/${outputName}`, fileBuffer, {
                    contentType: 'video/mp4',
                    upsert: true,
                })

            if (error) throw error
            console.log(`✅ Upload thành công: outputs/${outputName}`)

            // --- XOÁ FILE TẠM ---
            cleanup([tmpVideoPath, tmpAudioPath, outputPath])
        } catch (err) {
            console.error('❌ Lỗi khi xử lý job:', err)
        }
    }
}

// --- HÀM HỖ TRỢ ---

function wait(ms: number) {
    return new Promise((res) => setTimeout(res, ms))
}

function cleanup(paths: string[]) {
    for (const file of paths) {
        try {
            fs.unlinkSync(file)
        } catch (err) {
            console.warn(`⚠️ Không thể xoá file ${file}:`, err)
        }
    }
}

async function downloadFile(url: string, dest: string) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`❌ Không tải được file: ${url}`)
    const buffer = await res.buffer()
    fs.writeFileSync(dest, buffer)
}

function execPromise(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ FFmpeg lỗi:', stderr)
                reject(error)
            } else {
                console.log('✅ FFmpeg hoàn tất')
                resolve()
            }
        })
    })
}

// --- KHỞI ĐỘNG WORKER ---
runWorker()
