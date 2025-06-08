// worker/process-video-worker.ts
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { execSync } from 'child_process'

const TEMP = '/tmp'

function log(msg: string) {
    console.log(`[PROCESS] ${msg}`)
}

async function download(url: string, dest: string) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`❌ Không tải được: ${url}`)
    const fileStream = fs.createWriteStream(dest)
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream)
        res.body.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

async function run() {
    const outputName = process.env.OUTPUT_NAME
    const videoURL = process.env.INPUT_VIDEO_URL
    const audioURL = process.env.INPUT_AUDIO_URL

    if (!outputName || !videoURL || !audioURL) {
        console.error('❌ Thiếu ENV: OUTPUT_NAME / INPUT_VIDEO_URL / INPUT_AUDIO_URL')
        process.exit(1)
    }

    const jobDir = path.join(TEMP, `job-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fs.mkdirSync(jobDir)

    const inputVideo = path.join(jobDir, 'input.mp4')
    const inputAudio = path.join(jobDir, 'input.mp3')
    const cleanVideo = path.join(jobDir, 'clean.mp4')
    const output = path.join(TEMP, outputName) // Xuất file vào /tmp

    log('🔽 Đang tải video gốc...')
    await download(videoURL, inputVideo)

    log('🔽 Đang tải audio gốc...')
    await download(audioURL, inputAudio)

    log('✂️ Tách audio khỏi video...')
    execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)

    log('🎧 Ghép audio mới vào video sạch...')
    execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${output} -y`)

    log(`✅ Xử lý xong! Kết quả: ${output}`)
}

run().catch(err => {
    console.error('❌ Lỗi xử lý:', err)
    process.exit(1)
})
