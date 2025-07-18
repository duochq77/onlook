import { IncomingForm, File as FormidableFile } from 'formidable'
import fs from 'fs'
import { createReadStream } from 'fs'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export const config = {
    api: {
        bodyParser: false,
    },
}

// Cấu hình Cloudflare R2
const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export default async function handler(req: any, res: any) {
    const form = new IncomingForm({ uploadDir: '/tmp', keepExtensions: true })

    form.parse(req, async (err, fields, files) => {
        if (err || !files.file) {
            return res.status(500).json({ error: 'Lỗi khi xử lý upload' })
        }

        // Xử lý file đầu vào từ Formidable
        const file = Array.isArray(files.file) ? files.file[0] : files.file as FormidableFile
        const filePath = file.filepath
        const originalName = file.originalFilename || 'upload.mp4'

        const key = `${Date.now()}-${originalName}`

        const uploadCommand = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: key,
            Body: createReadStream(filePath),
            ContentType: 'video/mp4',
        })

        try {
            await R2.send(uploadCommand)
            res.status(200).json({
                message: '✅ Upload thành công',
                key,
            })
        } catch (e) {
            res.status(500).json({ error: '❌ Upload thất bại', detail: String(e) })
        }
    })
}
