// worker/process-video-worker.ts
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const TEMP = '/tmp'

function waitForFile(filePath: string, retries = 30) {
    for (let i = 0; i < retries; i++) {
        if (fs.existsSync(filePath)) return true
        console.log(`⏳ Chờ file ${filePath}...`)
        execSync('sleep 1')
    }
    return false
}

async function run() {
    const outputName = process.env.OUTPUT_NAME
    if (!outputName) {
        console.error('❌ Thiếu OUTPUT_NAME trong ENV!')
        return
    }

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const jobDir = path.join(TEMP, jobId)
    fs.mkdirSync(jobDir)

    // Đường dẫn tạm trong thư mục riêng
    const inputVideo = path.join(jobDir, `input-${outputName}.mp4`)
    const inputAudio = path.join(jobDir, `input-${outputName}.mp3`)
    const cleanVideo = path.join(jobDir, `clean-${outputName}`)
    const output = path.join(TEMP, outputName) // Xuất ra TEMP gốc để client tải

    // Copy từ gốc về thư mục riêng để xử lý an toàn
    fs.copyFileSync(path.join(TEMP, `input-${outputName}.mp4`), inputVideo)
    fs.copyFileSync(path.join(TEMP, `input-${outputName}.mp3`), inputAudio)

    if (!waitForFile(inputVideo) || !waitForFile(inputAudio)) {
        console.error('❌ Không tìm thấy file video hoặc audio!')
        return
    }

    console.log('✂️ Đang tách audio khỏi video...')
    execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)

    console.log('🎧 Đang ghép audio gốc vào video sạch...')
    execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${output} -y`)

    console.log('✅ Hoàn tất xử lý file:', output)
}

run()
