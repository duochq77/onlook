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

if (!fs.existsSync(TMP)) {
    console.error('❌ Thư mục /tmp không tồn tại hoặc không thể ghi!')
    process.exit(1)
}

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

const checkFileSize = (filePath: string) => {
    try {
        const stats = fs.statSync(filePath)
        return stats.size > 0
    } catch {
        return false
    }
}

async function processJob(job: {
    jobId: string
    videoUrl: string
    audioUrl: string
    outputName: string
}) {
    console.log("📌 Debug: job.outputName =", job.outputName, "typeof =", typeof job.outputName)
    console.log("📌 Debug: job.videoUrl =", job.videoUrl, "typeof =", typeof job.videoUrl)
    console.log("📌 Debug: job.audioUrl =", job.audioUrl, "typeof =", typeof job.audioUrl)
    console.log("📌 Debug: SUPABASE_STORAGE_BUCKET =", process.env.SUPABASE_STORAGE_BUCKET)

    if (
        typeof job.outputName !== 'string' || job.outputName.length === 0 ||
        typeof job.videoUrl !== 'string' || job.videoUrl.length === 0 ||
        typeof job.audioUrl !== 'string' || job.audioUrl.length === 0 ||
        !process.env.SUPABASE_STORAGE_BUCKET
    ) {
        console.error('❌ Thiếu biến môi trường hoặc tham số job không hợp lệ!')
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

        console.log("📌 Kiểm tra file tải về:")
        console.log("📌 inputVideo tồn tại:", fs.existsSync(inputVideo))
        console.log("📌 inputAudio tồn tại:", fs.existsSync(inputAudio))

        console.log("📌 Kiểm tra dung lượng file:")
        console.log("📌 inputVideo kích thước:", checkFileSize(inputVideo) ? "OK" : "Không hợp lệ")
        console.log("📌 inputAudio kích thước:", checkFileSize(inputAudio) ? "OK" : "Không hợp lệ")

        if (!fs.existsSync(inputVideo) || !fs.existsSync(inputAudio)) {
            throw new Error('❌ File tải về không tồn tại!')
        }
        if (!checkFileSize(inputVideo) || !checkFileSize(inputAudio)) {
            throw new Error('❌ File tải về có dung lượng 0, không hợp lệ!')
        }

        try {
            console.log('✂️ Đang tách audio khỏi video...')
            execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)
        } catch (ffmpegErr) {
            console.error('❌ Lỗi FFmpeg tách audio:', ffmpegErr)
            throw ffmpegErr
        }

        try {
            console.log('🎧 Đang ghép audio gốc vào video sạch...')
            execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`)
        } catch (ffmpegErr) {
            console.error('❌ Lỗi FFmpeg ghép audio:', ffmpegErr)
            throw ffmpegErr
        }

        console.log('📌 Upload lên Supabase...')
        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(`outputs/${job.outputName}`, fs.createReadStream(outputFile), {
                contentType: 'video/mp4',
                upsert: true,
            })

        if (error) {
            console.error(`❌ Lỗi upload file merged:`, error.message)
            throw error
        } else {
            console.log(`✅ File uploaded thành công:`, data)
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

            let job
            try {
                job = JSON.parse(jobJson)
            } catch (parseErr) {
                console.error('❌ Job nhận từ Redis không hợp lệ:', jobJson)
                continue
            }

            if (!job || typeof job !== 'object') {
                console.error('❌ Job nhận từ Redis bị lỗi hoặc không hợp lệ:', job)
                continue
            }

            await processJob(job)
        } catch (err) {
            console.error('❌ Lỗi worker:', err)
            await new Promise((r) => setTimeout(r, 5000))
        }
    }
}

runWorker()
