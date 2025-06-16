import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import os from 'os'
import path from 'path'

// 📦 Khai báo biến môi trường
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'stream-files'

if (!supabaseUrl || !supabaseKey) {
    throw new Error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
}

// 🔑 Tạo Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        // 🔗 2 file nguyên liệu thực tế
        const fileId = 'input-1750045322875-axtkedis3zr'
        const videoPath = `input-videos/${fileId}.mp4`
        const audioPath = `input-audios/${fileId}.mp3`

        // 📁 Thư mục tạm trên RAM
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onlook-test-'))
        const videoFile = path.join(tmpDir, 'downloaded-video.mp4')
        const audioFile = path.join(tmpDir, 'downloaded-audio.mp3')

        // 🎬 Tải video
        const { data: videoData, error: videoError } = await supabase
            .storage
            .from(bucket)
            .download(videoPath)

        if (videoError) throw new Error(`❌ Tải video thất bại: ${videoError.message}`)
        fs.writeFileSync(videoFile, Buffer.from(await videoData.arrayBuffer()))

        // 🎧 Tải audio
        const { data: audioData, error: audioError } = await supabase
            .storage
            .from(bucket)
            .download(audioPath)

        if (audioError) throw new Error(`❌ Tải audio thất bại: ${audioError.message}`)
        fs.writeFileSync(audioFile, Buffer.from(await audioData.arrayBuffer()))

        // ✅ Kết quả test thành công
        return res.status(200).json({
            success: true,
            message: 'Tải về thành công cả 2 file',
            tempPaths: {
                video: videoFile,
                audio: audioFile
            }
        })
    } catch (err: any) {
        console.error('❌ Lỗi tải file:', err)
        return res.status(500).json({ success: false, error: err.message })
    }
}
