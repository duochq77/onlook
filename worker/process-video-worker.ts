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

// Sửa hàm download để chuyển ReadableStream web sang Node.js stream
async function download(url: string, dest: string) {
    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error(`❌ Không tải được: ${url}`)

    const fileStream = fs.createWriteStream(dest)
    const nodeStream = Readable.from(res.body as any) // chuyển sang Node.js stream

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
        const uploadRes = await supabase.storage.from('stream-files').upload(
            `outputs/${job.outputName}`,
            fs.createReadStream(outputFile),
            {
                contentType: 'video/mp4',
                upsert: true,
            }
        )

        if (uploadRes.error) {
            throw new Error(`❌ Lỗi khi upload file merged: ${uploadRes.error.message}`)
        }

        // Xoá file nguyên liệu cũ
        const extractPath = (url: string) => url.split('/object/public/stream-files/')[1]
        await supabase.storage.from('stream-files').remove([extractPath(job.videoUrl)])
        await supabase.storage.from('stream-files').remove([extractPath(job.audioUrl)])

        console.log(`✅ Hoàn tất job ${job.jobId}: outputs/${job.outputName}`)
    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
    }
}

async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy...')

    while (true) {
        try {
            // Lấy job cuối (đẩy vào đầu), đợi tối đa 30s
            const jobJson = await redis.brpop('onlook:process-video-queue', 30)
            if (!jobJson) {
                // Không có job, tiếp tục vòng lặp
                continue
            }

            // brpop trả về [key, value]
            const jobPayload = jobJson[1]
            const job = JSON.parse(jobPayload)
            await processJob(job)
        } catch (err) {
            console.error('❌ Lỗi worker:', err)
            // Có thể thêm delay để tránh vòng lặp quá nhanh khi lỗi
            await new Promise((r) => setTimeout(r, 5000))
        }
    }
}

runWorker()
