import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
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

    const form = new formidable.IncomingForm()
    form.uploadDir = '/tmp'
    form.keepExtensions = true

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('❌ Lỗi parse form:', err)
            return res.status(500).json({ error: 'Lỗi khi xử lý form' })
        }

        const video = files.video?.[0]
        const audio = files.audio?.[0]

        if (!video || !audio) {
            return res.status(400).json({ error: 'Thiếu video hoặc audio' })
        }

        const id = uuidv4()
        const videoName = `input-videos/${id}.mp4`
        const audioName = `input-audios/${id}.mp3`
        const outputName = `merged-${id}.mp4`

        console.log('📤 Đang upload file lên Supabase...')
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

        console.log('🔑 Đang lấy Google Access Token từ Service Account...')
        let accessToken: string
        try {
            accessToken = await getGoogleAccessToken()
            console.log('✅ Token lấy thành công.')
        } catch (err) {
            console.error('❌ Lỗi lấy Google token:', err)
            return res.status(500).json({ error: 'Không lấy được access token từ Google' })
        }

        console.log('🚀 Gửi yêu cầu tới Cloud Run Job:', process.env.CLOUD_RUN_URL)
        const triggerRes = await fetch(`${process.env.CLOUD_RUN_URL}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                INPUT_VIDEO_URL: videoUrl,
                INPUT_AUDIO_URL: audioUrl,
                OUTPUT_NAME: outputName,
            }),
        })

        if (!triggerRes.ok) {
            const errorText = await triggerRes.text()
            console.error('❌ Lỗi gọi Cloud Run:', errorText)
            return res.status(500).json({ error: 'Không gọi được job xử lý video', detail: errorText })
        }

        console.log('✅ Job xử lý đã được gửi thành công tới Cloud Run.')
        return res.status(200).json({ outputName })
    })
}
