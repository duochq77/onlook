import 'dotenv/config'
import fs from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { Readable } from 'stream'

// Đọc biến môi trường truyền lên chứa jobPayload JSON string
const rawJobPayload = process.env.JOB_PAYLOAD
if (!rawJobPayload) {
    console.error('❌ Thiếu biến môi trường JOB_PAYLOAD chứa dữ liệu job')
    process.exit(1)
}

let job: {
    jobId: string
    videoUrl: string
    audioUrl: string
    outputName: string
}

try {
    job = JSON.parse(rawJobPayload)
} catch {
    console.error('❌ JOB_PAYLOAD không hợp lệ JSON:', rawJobPayload)
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TMP = '/tmp'

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

const checkFileSize = (filePath: string) => {
    try {
        const stats = fs.statSync(filePath)
        return stats.size > 0
    } catch {
        return false
    }
}

async function processJob() {
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

        // Dọn file tạm
        ;[inputVideo, inputAudio, cleanVideo, outputFile].forEach(f => {
            if (fs.existsSync(f)) {
                try {
                    fs.unlinkSync(f)
                    console.log(`✅ Đã xóa file tạm: ${f}`)
                } catch (e) {
                    console.warn(`⚠️ Lỗi khi xóa file tạm ${f}:`, e)
                }
            }
        })

        console.log(`✅ Hoàn tất job ${job.jobId}: outputs/${job.outputName}`)
    } catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err)
        process.exit(1)
    }
}

processJob()
