import 'dotenv/config'
import fs from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { Readable } from 'stream'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TMP = '/tmp'

async function download(url: string, dest: string) {
    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error(`❌ Không tải được: ${url}`)

    const fileStream = fs.createWriteStream(dest)
    const nodeStream = Readable.from(res.body as any)

    await new Promise<void>((resolve, reject) => {
        nodeStream.pipe(fileStream)
        nodeStream.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

async function processJob(job: {
    jobId: string
    videoUrl: string
    audioUrl: string
    outputName: string
}) {
    // Log debug các tham số và biến môi trường
    console.log("📌 Debug: job.outputName =", job.outputName)
    console.log("📌 Debug: job.videoUrl =", job.videoUrl)
    console.log("📌 Debug: job.audioUrl =", job.audioUrl)
    console.log("📌 Debug: SUPABASE_STORAGE_BUCKET =", process.env.SUPABASE_STORAGE_BUCKET)

    if (!job.outputName || !job.videoUrl || !job.audioUrl || !process.env.SUPABASE_STORAGE_BUCKET) {
        console.error('❌ Thiếu biến môi trường hoặc tham số job!')
        process.exit(1)
    }

    const inputVideo = path.join(TMP, 'input.mp4')
    const inputAudio = path.join(TMP, 'input.mp3')
    const cleanVideo = path.join(TMP, 'clean.mp4')
    const outputFile = path.join(TMP, job.outputName)

    console.log(`🟢 Bắt đầu xử lý job ${job.jobId}`)

    try {
        console.log('📥 Đang tải video + audio từ Supabase...')
        await download(job.videoUrl, inputVideo)
        await download(job.audioUrl, inputAudio)

        if (!fs.existsSync(inputVideo) || !fs.existsSync(inputAudio)) {
            throw new Error('❌ File tải về không tồn tại!')
        }

        console.log('✂️ Đang tách audio khỏi video...')
        execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)

        console.log('🎧 Đang ghép audio gốc vào video sạch...')
        execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`)

        console.log('🚀 Upload file merged lên Supabase...')
        const uploadRes = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(`outputs/${job.outputName}`, fs.createReadStream(outputFile), {
                contentType: 'video/mp4',
                upsert: true,
            })

        if (uploadRes.error) {
            throw new Error(`❌ Lỗi khi upload file merged: ${uploadRes.error.message}`)
        }

        // Xóa file nguyên liệu cũ
        const extractPath = (url: string) => url.split(`/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/`)[1]
        await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove([extractPath(job.videoUrl)])
        await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove([extractPath(job.audioUrl)])

        console.log(`✅ Hoàn tất job ${job.jobId}: outputs/${job.outputName}`)
    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
    }
}

async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy...')

    while (true) {
        try {
            const jobJson = await redis.rpop('onlook:process-video-queue')
            if (!jobJson) {
                await new Promise((r) => setTimeout(r, 3000))
                continue
            }

            const job = JSON.parse(jobJson)
            await processJob(job)
        } catch (err) {
            console.error('❌ Lỗi worker:', err)
            await new Promise((r) => setTimeout(r, 5000))
        }
    }
}

runWorker()
