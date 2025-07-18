import express from 'express'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import { createReadStream } from 'fs'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import { RoomServiceClient } from 'livekit-server-sdk'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8080

app.get('/', (_, res) => {
    res.send('✅ Ingress worker is running')
})

app.post('/upload', async (req, res) => {
    const form = new IncomingForm({ uploadDir: '/tmp', keepExtensions: true })
    form.parse(req, async (err, fields, files) => {
        if (err || !files.file) {
            return res.status(500).json({ error: 'Lỗi khi xử lý upload' })
        }

        const file = Array.isArray(files.file) ? files.file[0] : files.file
        const filePath = file.filepath
        const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.mp4`

        const r2 = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
            },
        })

        const uploadCmd = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: fileName,
            Body: createReadStream(filePath),
            ContentType: 'video/mp4',
        })

        try {
            await r2.send(uploadCmd)
            console.log(`✅ Đã upload video lên R2: ${fileName}`)

            const room = fileName.replace('.mp4', '') // tên phòng giống tên file

            const svc = new RoomServiceClient(
                process.env.LIVEKIT_URL!,
                process.env.LIVEKIT_API_KEY!,
                process.env.LIVEKIT_API_SECRET!
            )
            await svc.createRoom({ name: room })

            console.log(`🎬 Đã tạo phòng livestream: ${room}`)

            return res.status(200).json({ message: 'Thành công', roomName: room, fileKey: fileName })
        } catch (e) {
            console.error('❌ Upload hoặc tạo phòng thất bại:', e)
            return res.status(500).json({ error: 'Upload hoặc tạo phòng thất bại' })
        }
    })
})

app.listen(PORT, () => {
    console.log(`🚀 Ingress worker listening on port ${PORT}`)
})
