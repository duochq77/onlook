import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
    api: {
        bodyParser: false, // Bắt buộc để xử lý file
    },
}

const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' })

    const form = new formidable.IncomingForm({ uploadDir: '/tmp', keepExtensions: true })

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: 'Upload error', detail: err })

        const file = files.file?.[0]
        const jobId = fields.jobId?.[0]

        if (!file || !jobId) return res.status(400).json({ error: 'Thiếu file hoặc jobId' })

        const fileStream = fs.createReadStream(file.filepath)
        const fileKey = `audio/${jobId}.mp3`

        try {
            await R2.send(
                new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME!,
                    Key: fileKey,
                    Body: fileStream,
                    ContentType: 'audio/mpeg',
                    ACL: 'public-read', // Quan trọng để tạo URL công khai
                })
            )

            const publicUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`

            return res.status(200).json({ success: true, url: publicUrl, key: fileKey })
        } catch (e) {
            return res.status(500).json({ error: 'R2 upload failed', detail: (e as Error).message })
        }
    })
}
