// worker/process-video-worker.ts
import 'dotenv/config'
import fs from 'fs'
import { execSync } from 'child_process'
import fetch from 'node-fetch'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TMP = '/tmp'

// Lấy biến môi trường, có thể undefined
const INPUT_VIDEO_URL = process.env.INPUT_VIDEO_URL
const INPUT_AUDIO_URL = process.env.INPUT_AUDIO_URL
const OUTPUT_NAME = process.env.OUTPUT_NAME

// Kiểm tra biến môi trường bắt buộc
if (!INPUT_VIDEO_URL || !INPUT_AUDIO_URL || !OUTPUT_NAME) {
    console.error('❌ Thiếu biến môi trường bắt buộc: INPUT_VIDEO_URL, INPUT_AUDIO_URL hoặc OUTPUT_NAME')
    process.exit(1)
}

// Ép kiểu chắc chắn là string
const inputVideoUrl: string = INPUT_VIDEO_URL
const inputAudioUrl: string = INPUT_AUDIO_URL
const outputName: string = OUTPUT_NAME

const inputVideo = path.join(TMP, 'input.mp4')
const inputAudio = path.join(TMP, 'input.mp3')
const cleanVideo = path.join(TMP, 'clean.mp4')
const outputFile = path.join(TMP, outputName)

async function download(url: string, dest: string) {
    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error(`❌ Không tải được: ${url}`)

    const fileStream = fs.createWriteStream(dest)
    await new Promise<void>((resolve, reject) => {
        res.body!.pipe(fileStream)
        res.body!.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

async function run() {
    console.log('📥 Đang tải video + audio từ Supabase...')
    await download(inputVideoUrl, inputVideo)
    await download(inputAudioUrl, inputAudio)

    if (!fs.existsSync(inputVideo) || !fs.existsSync(inputAudio)) {
        console.error('❌ File tải về không tồn tại!')
        process.exit(1)
    }

    console.log('✂️ Đang tách audio khỏi video...')
    execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)

    console.log('🎧 Đang ghép audio gốc vào video sạch...')
    execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`)

    console.log('🚀 Upload file merged lên Supabase...')
    const uploadRes = await supabase.storage.from('stream-files').upload(
        `outputs/${outputName}`,
        fs.createReadStream(outputFile),
        {
            contentType: 'video/mp4',
            upsert: true,
        }
    )

    if (uploadRes.error) {
        console.error('❌ Lỗi khi upload file merged:', uploadRes.error)
        process.exit(1)
    }

    // Tự động xoá 2 file nguyên liệu cũ
    const extractPath = (url: string) => url.split('/object/public/stream-files/')[1]

    const deleteVideo = await supabase.storage.from('stream-files').remove([extractPath(inputVideoUrl)])
    const deleteAudio = await supabase.storage.from('stream-files').remove([extractPath(inputAudioUrl)])

    if (deleteVideo.error || deleteAudio.error) {
        console.warn('⚠️ Lỗi khi xoá file gốc:', deleteVideo.error || '', deleteAudio.error || '')
    } else {
        console.log('🗑️ Đã xoá file nguyên liệu khỏi Supabase.')
    }

    console.log(`✅ Xử lý hoàn tất: outputs/${outputName}`)
}

run()
