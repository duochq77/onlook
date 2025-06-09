import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import formidable from 'formidable'
import fs from 'fs'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'

export const config = {
    api: {
        bodyParser: false,
    },
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const bucket = 'stream-files'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

    const form = formidable({ uploadDir: '/tmp', keepExtensions: true })
    let fields: formidable.Fields
    let files: formidable.Files

    try {
        [fields, files] = await form.parse(req)
    } catch (err) {
        console.error('❌ Lỗi parse form:', err)
        return res.status(500).json({ error: 'Lỗi khi xử lý form' })
    }

    const video = Array.isArray(files.video) ? files.video[0] : files.video
    const audio = Array.isArray(files.audio) ? files.audio[0] : files.audio

    if (!video || !audio) {
        return res.status(400).json({ error: 'Thiếu video hoặc audio' })
    }

    const id = uuidv4()
    const videoName = `input-videos/${id}.mp4`
    const audioName = `input-audios/${id}.mp3`
    const outputName = `merged-${id}.mp4`

    console.log('📤 Upload lên Supabase...')
    const uploadVideo = await supabase.storage
        .from(bucket)
        .upload(videoName, fs.createReadStream(video.filepath), {
            contentType: 'video/mp4',
            upsert: true,
        })

    const uploadAudio = await supabase.storage
        .from(bucket)
        .upload(audioName, fs.createReadStream(audio.filepath), {
            contentType: 'audio/mpeg',
            upsert: true,
        })

    if (uploadVideo.error || uploadAudio.error) {
        console.error('❌ Upload lỗi:', uploadVideo.error, uploadAudio.error)
        return res.status(500).json({ error: 'Không upload được file lên Supabase' })
    }

    const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${videoName}`
    const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${audioName}`

    let accessToken: string
    try {
        accessToken = await getGoogleAccessToken()
    } catch (err) {
        console.error('❌ Lỗi lấy Google token:', err)
        return res.status(500).json({ error: 'Không lấy được access token từ Google' })
    }

    console.log('🚀 Gửi job Cloud Run...')
    const triggerRes = await fetch(`${process.env.CLOUD_RUN_URL}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            taskOverrides: {
                env: [
                    { name: 'OUTPUT_NAME', value: outputName },
                    { name: 'INPUT_VIDEO_URL', value: videoUrl },
                    { name: 'INPUT_AUDIO_URL', value: audioUrl },
                ],
            },
        }),
    })

    if (!triggerRes.ok) {
        const errorText = await triggerRes.text()
        console.error('❌ Cloud Run lỗi:', errorText)
        return res.status(500).json({ error: 'Không gọi được job xử lý', detail: errorText })
    }

    console.log('✅ Job xử lý đã gửi thành công.')
    return res.status(200).json({ outputName })
}
