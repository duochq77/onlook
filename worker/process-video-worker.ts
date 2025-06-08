import 'dotenv/config'
import fs from 'fs'
import { execSync } from 'child_process'
import fetch from 'node-fetch'
import path from 'path'

const OUTPUT_NAME = process.env.OUTPUT_NAME!
const INPUT_VIDEO_URL = process.env.INPUT_VIDEO_URL!
const INPUT_AUDIO_URL = process.env.INPUT_AUDIO_URL!

const TMP = '/tmp'
const inputVideo = path.join(TMP, 'input.mp4')
const inputAudio = path.join(TMP, 'input.mp3')
const cleanVideo = path.join(TMP, 'clean.mp4')
const output = path.join(TMP, OUTPUT_NAME)

async function download(url: string, dest: string) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`❌ Không tải được: ${url}`)
    if (!res.body) throw new Error(`❌ Phản hồi rỗng từ: ${url}`)

    const fileStream = fs.createWriteStream(dest)
    await new Promise<void>((resolve, reject) => {
        res.body!.pipe(fileStream)
        res.body!.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

async function run() {
    console.log('📥 Đang tải file video và audio...')
    await download(INPUT_VIDEO_URL, inputVideo)
    await download(INPUT_AUDIO_URL, inputAudio)

    if (!fs.existsSync(inputVideo) || !fs.existsSync(inputAudio)) {
        console.error('❌ File tải về không tồn tại!')
        process.exit(1)
    }

    console.log('✂️ Tách audio khỏi video...')
    try {
        execSync(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`)
    } catch (err) {
        console.error('❌ Lỗi khi tách audio:', err)
        process.exit(1)
    }

    console.log('🎧 Ghép audio mới vào video...')
    try {
        execSync(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${output} -y`)
    } catch (err) {
        console.error('❌ Lỗi khi ghép audio:', err)
        process.exit(1)
    }

    console.log(`✅ Xong! File tạo ra: ${output}`)
}

run()
