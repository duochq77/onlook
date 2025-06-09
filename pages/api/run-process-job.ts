// pages/api/run-process-job.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

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

        const uploadVideo = await supabase.storage.from(bucket).upload(videoName, fs.createReadStream(video.filepath), {
            contentType: 'video/mp4',
            upsert: true,
        })

        const uploadAudio = await supabase.storage.from(bucket).upload(audioName, fs.createReadStream(audio.filepath), {
            contentType: 'audio/mpeg',
            upsert: true,
        })

        if (uploadVideo.error || uploadAudio.error) {
            console.error('❌ Upload lỗi:', uploadVideo.error, uploadAudio.error)
            return res.status(500).json({ error: 'Không upload được file lên Supabase' })
        }

        const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${videoName}`
        const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${audioName}`

        // Gọi Cloud Run Job
        const triggerRes = await fetch(`${process.env.CLOUD_RUN_URL}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN!}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                INPUT_VIDEO_URL: videoUrl,
                INPUT_AUDIO_URL: audioUrl,
                OUTPUT_NAME: outputName,
            }),
        })

        if (!triggerRes.ok) {
            console.error('❌ Lỗi gọi Cloud Run:', await triggerRes.text())
            return res.status(500).json({ error: 'Không gọi được worker' })
        }

        return res.status(200).json({ outputName })
    })
}
