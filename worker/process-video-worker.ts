import 'dotenv/config'
import fs from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { Readable } from 'stream'

// ==== Bước 1: Log biến môi trường để debug ====
console.log('--- DEBUG ENV VARIABLES ---')
console.log('NEXT_PUBLIC_SUPABASE_URL =', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY =', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'OK' : 'MISSING')
console.log('SUPABASE_STORAGE_BUCKET =', process.env.SUPABASE_STORAGE_BUCKET)
console.log('UPSTASH_REDIS_REST_URL =', process.env.UPSTASH_REDIS_REST_URL)
console.log('UPSTASH_REDIS_REST_TOKEN =', process.env.UPSTASH_REDIS_REST_TOKEN ? 'OK' : 'MISSING')

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
    console.log('Downloading:', url)
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

// Kiểm tra dung lượng file có lớn hơn 0 không
const checkFileSize = (filePath: string) => {
    try {
        const stats = fs.statSync(filePath)
        return stats.size > 0
    } catch {
        return false
    }
}

// Hàm trích xuất đường dẫn file chuẩn để xóa file trên Supabase Storage
const extractPath = (url: string) => {
    try {
        const parts = url.split(`/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/`)
        if (parts.length === 2) {
            console.log('extractPath:', parts[1])
            return parts[1]
        } else {
            console.warn('⚠️ Không thể trích xuất đường dẫn đúng từ URL:', url)
            return ''
        }
    } catch (e) {
        console.error('❌ Lỗi trích xuất đường dẫn xóa file:', e)
        return ''
    }
}

async function processJob(job: {
    jobId: string
    videoUrl: string
    audioUrl: string
    outputName?: string
}) {
    console.log('📌 Debug: job nhận từ Redis =', job)

    console.log('🔍 Kiểu dữ liệu job:', typeof job)
    console.log('🔍 Kiểm tra outputName:', job.outputName, typeof job.outputName)

    if (!job.outputName || typeof job.outputName !== 'string') {
        console.error('❌ outputName không hợp lệ hoặc thiếu:', job.outputName)
        return
    }

    if (
        !job.videoUrl ||
        !job.audioUrl ||
        !process.env.SUPABASE_STORAGE_BUCKET
    ) {
        console.error('❌ Thiếu giá trị job hoặc biến môi trường! Dừng Worker.')
        process.exit(1)
    }

    if (typeof TMP !== 'string' || TMP.length === 0) {
        console.error('❌ Biến TMP không hợp lệ:', TMP)
        process.exit(1)
    }

    const inputVideo = path.join(TMP, 'input.mp4')
    const inputAudio = path.join(TMP, 'input.mp3')
    const cleanVideo = path.join(TMP, 'clean.mp4')
    const outputFile = path.join(TMP, job.outputName)

    try {
        console.log('📥 Đang tải video + audio từ Supabase...')
        await download(job.videoUrl, inputVideo)
        await download(job.audioUrl, inputAudio)

        console.log('📌 Kiểm tra file tồn tại trên Worker:')
        console.log('📌 inputVideo:', fs.existsSync(inputVideo))
        console.log('📌 inputAudio:', fs.existsSync(inputAudio))

        console.log('📌 Kiểm tra dung lượng file:')
        console.log('📌 inputVideo kích thước:', checkFileSize(inputVideo) ? 'OK' : 'Không hợp lệ')
        console.log('📌 inputAudio kích thước:', checkFileSize(inputAudio) ? 'OK' : 'Không hợp lệ')

        if (!fs.existsSync(inputVideo) || !fs.existsSync(inputAudio)) {
            throw new Error('❌ File tải về không tồn tại!')
        }
        if (!checkFileSize(inputVideo) || !checkFileSize(inputAudio)) {
            throw new Error('❌ File tải về có dung lượng 0, không hợp lệ!')
        }

        console.log('✂️ Đang tách audio khỏi video...')
        execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)

        console.log('🎧 Đang ghép audio gốc vào video sạch...')
        execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`)

        console.log('📌 Upload lên Supabase...')
        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(`outputs/${job.outputName}`, fs.createReadStream(outputFile), {
                contentType: 'video/mp4',
                upsert: true,
            })

        if (error) {
            console.error('❌ Lỗi upload file merged:', error.message)
            throw error
        } else {
            console.log('✅ File uploaded thành công:', data)
        }

        const videoPath = extractPath(job.videoUrl)
        const audioPath = extractPath(job.audioUrl)

        if (videoPath) {
            await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove([videoPath])
            console.log(`✅ Đã xóa file video nguyên liệu: ${videoPath}`)
        }
        if (audioPath) {
            await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove([audioPath])
            console.log(`✅ Đã xóa file audio nguyên liệu: ${audioPath}`)
        }

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
