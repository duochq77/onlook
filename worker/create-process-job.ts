// ✅ create-process-job.ts - Express version (Cloud Run worker)
import express from 'express'
import cors from 'cors'
import { IncomingForm } from 'formidable'
import fs from 'fs/promises'
import mime from 'mime-types'
import { randomUUID } from 'crypto'
import { createClient } from 'redis'

const app = express()
const port = process.env.PORT || 8080

app.use(cors())
app.options('*', cors())

const redis = createClient({
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
    password: process.env.REDIS_PASSWORD,
})

const UPLOAD_DIR = '/tmp/uploads'

app.post('/create', async (req, res) => {
    const form = new IncomingForm({ uploadDir: UPLOAD_DIR, keepExtensions: true })

    try {
        await redis.connect()

        form.parse(req, async (err, fields, files) => {
            if (err) return res.status(500).json({ error: 'Form parse error' })

            const video = Array.isArray(files.video) ? files.video[0] : files.video
            const audio = Array.isArray(files.audio) ? files.audio[0] : files.audio
            if (!video || !audio) return res.status(400).json({ error: 'Missing files' })

            const jobId = `job-${Date.now()}-${randomUUID().slice(0, 8)}`
            const videoKey = `inputs/${jobId}-video.${mime.extension(video.mimetype!) || 'mp4'}`
            const audioKey = `inputs/${jobId}-audio.${mime.extension(audio.mimetype!) || 'mp3'}`
            const outputKey = `outputs/merged-${jobId}.mp4`

            await uploadToR2(video.filepath, videoKey)
            await uploadToR2(audio.filepath, audioKey)

            const payload = JSON.stringify({
                videoUrl: r2PublicUrl(videoKey),
                audioUrl: r2PublicUrl(audioKey),
                outputKey,
            })

            await redis.zAdd('process-jobs', [{ score: Date.now(), value: payload }])

            return res.status(200).json({ success: true, jobId, outputKey })
        })
    } catch (err) {
        console.error('❌ Upload failed:', err)
        return res.status(500).json({ error: 'Internal Server Error' })
    } finally {
        await redis.disconnect()
    }
})

async function uploadToR2(filePath: string, key: string) {
    const file = await fs.readFile(filePath)
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`

    const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': file.length.toString(),
            'x-amz-acl': 'public-read',
        },
        body: file,
    })

    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
}

function r2PublicUrl(key: string) {
    return `https://${process.env.NEXT_PUBLIC_R2_BUCKET}.r2.dev/${key}`
}

app.listen(port, () => {
    console.log(`🚀 create-process-job worker listening on port ${port}`)
})
