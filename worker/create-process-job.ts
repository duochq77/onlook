import express from 'express'
import cors from 'cors'
import { IncomingForm, File } from 'formidable'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import Redis from 'ioredis'
import fs from 'fs'

const app = express()
const port = parseInt(process.env.PORT || '8080', 10)

app.use(cors())
app.options('*', cors())

// === Kiểm tra ENV bắt buộc ===
const requiredEnv = [
    'R2_BUCKET_NAME',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
]
for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`❌ Thiếu biến môi trường: ${key}`)
    }
}

// === Redis TCP (ioredis + TLS) ===
const redis = new Redis({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD!,
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    tls: {} // Bắt buộc cho Upstash Redis TCP
})

redis.on('error', (err) => {
    console.error('❌ Redis error:', err)
})

// === Cloudflare R2 (S3-compatible) ===
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

app.post('/create', (req, res) => {
    const form = new IncomingForm({ multiples: false, keepExtensions: true })

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('❌ Lỗi parse form:', err)
            return res.status(500).json({ error: 'Lỗi xử lý form dữ liệu.' })
        }

        try {
            const rawVideo = files.video
            const rawAudio = files.audio
            if (!rawVideo || !rawAudio) {
                return res.status(400).json({ error: 'Thiếu video hoặc audio' })
            }

            const video = Array.isArray(rawVideo) ? rawVideo[0] : rawVideo
            const audio = Array.isArray(rawAudio) ? rawAudio[0] : rawAudio

            const id = Date.now()
            const unique = Math.random().toString(36).substring(2, 8)

            const videoKey = `inputs/${id}-${unique}-video.mp4`
            const audioKey = `inputs/${id}-${unique}-audio.mp3`
            const outputKey = `outputs/merged-${id}-${unique}.mp4`

            // ⬆️ Upload lên R2
            await uploadToR2(video.filepath, videoKey, video.mimetype || 'video/mp4')
            await uploadToR2(audio.filepath, audioKey, audio.mimetype || 'audio/mpeg')

            // 📥 Push job vào Redis
            const job = { id, videoKey, audioKey, outputKey }
            await redis.zadd('process-jobs', Date.now(), JSON.stringify(job))

            console.log('✅ Đã đẩy job vào Redis:', job)
            res.status(200).json({ success: true, outputKey })
        } catch (error) {
            console.error('❌ Lỗi xử lý job:', error)
            res.status(500).json({ error: 'Xử lý thất bại', detail: String(error) })
        }
    })
})

async function uploadToR2(filePath: string, key: string, contentType: string) {
    const fileStream = fs.createReadStream(filePath)
    const uploadParams = {
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
    }

    await s3.send(new PutObjectCommand(uploadParams))
    console.log(`📦 Uploaded to R2: ${key}`)
}

app.listen(port, () => {
    console.log(`🚀 create-process-job worker running on port ${port}`)
})
