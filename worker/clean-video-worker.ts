import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import util from 'util'

const execPromise = util.promisify(exec)

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function runWorker() {
    console.log('🎬 CLEAN Video Worker đang chạy...')

    const rawJob = await redis.lpop<string>('ffmpeg-jobs:clean')
    if (!rawJob) {
        console.log('⏹ Không có job nào trong hàng đợi. Kết thúc worker.')
        return
    }

    let job: { inputVideo: string; outputName: string }

    try {
        job = JSON.parse(rawJob)
    } catch (err) {
        console.error('💥 Lỗi: Không thể parse job JSON:', rawJob)
        return
    }

    const { inputVideo, outputName } = job
    console.log('📥 Nhận job CLEAN:', job)

    const tmpInputPath = path.join('/tmp', 'input.mp4')
    const tmpOutputPath = path.join('/tmp', 'clean-video.mp4')
    const errorLogPath = path.join('/tmp', 'ffmpeg-error.log')

    const { data, error } = await supabase
        .storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .download(inputVideo)

    if (error || !data) {
        console.error('❌ Lỗi tải video từ Supabase:', error)
        return
    }

    const fileBuffer = await data.arrayBuffer()
    fs.writeFileSync(tmpInputPath, Buffer.from(fileBuffer))

    const ffmpegCmd = `ffmpeg -y -i ${tmpInputPath} -an -c:v copy ${tmpOutputPath} 2> ${errorLogPath}`
    console.log('⚙️ Chạy FFmpeg:', ffmpegCmd)

    try {
        await execPromise(ffmpegCmd)
        console.log('✅ Đã tạo video sạch:', tmpOutputPath)
    } catch (err) {
        const ffmpegLogs = fs.readFileSync(errorLogPath, 'utf-8')
        console.error('💥 FFmpeg lỗi:', ffmpegLogs)
        return
    }

    // Gọi merge-job
    const siteURL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!siteURL) {
        console.error('❌ Thiếu biến môi trường SITE_URL')
        return
    }

    const mergeRes = await fetch(`${siteURL}/api/merge-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cleanVideoPath: tmpOutputPath,
            originalAudioPath: inputVideo.replace('input-videos/', 'input-audios/').replace('-video.mp4', '-audio.mp3'),
            outputName,
        }),
    })

    if (!mergeRes.ok) {
        const errText = await mergeRes.text()
        console.warn('⚠️ Gọi merge-job thất bại:', errText)
    } else {
        console.log('🚀 Gọi merge-job thành công')
    }

    console.log('✅ Worker đã hoàn thành 1 job. Thoát.')
}

runWorker().catch(console.error)
