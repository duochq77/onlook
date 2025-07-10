import express from 'express'
import cors from 'cors'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import formidable from 'formidable'
import fs from 'fs'

const app = express()
app.use(cors())

const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

app.post('/upload', async (req, res) => {
    const form = new formidable.IncomingForm({ uploadDir: '/tmp', keepExtensions: true })

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: 'Upload error', detail: err })

        const file = files.file
        const jobId = fields.jobId?.[0]

        if (!file || !jobId) return res.status(400).json({ error: 'Thiếu file hoặc jobId' })

        const filePath = (file as any).filepath || (Array.isArray(file) && file[0]?.filepath)
        if (!filePath) return res.status(400).json({ error: 'Không tìm thấy đường dẫn file' })

        const fileStream = fs.createReadStream(filePath)
        const fileKey = `audio/${jobId}.mp3`

        try {
            await R2.send(
                new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME!,
                    Key: fileKey,
                    Body: fileStream,
                    ContentType: 'audio/mpeg',
                    ACL: 'public-read',
                })
            )

            const publicUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`
            return res.status(200).json({ success: true, url: publicUrl, key: fileKey })
        } catch (e: any) {
            return res.status(500).json({ error: 'R2 upload failed', detail: e.message })
        }
    })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
    console.log(`🚀 Upload Audio Worker running on port ${PORT}`)
})
