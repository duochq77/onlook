import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import formidable from 'formidable'
import fs from 'fs'

export const config = {
    api: {
        bodyParser: false, // Bắt buộc để nhận multipart/form-data
    },
}

// Khởi tạo kết nối Cloudflare R2
const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export default async function handler(req: any, res: any) {
    console.log('📥 Nhận yêu cầu upload-audio-to-r2...')

    if (req.method !== 'POST') {
        console.warn('❌ Sai method:', req.method)
        return res.status(405).json({ error: 'Only POST allowed' })
    }

    // Cấu hình Formidable để xử lý upload chuẩn
    const form = formidable({
        multiples: false,
        uploadDir: '/tmp',
        keepExtensions: true,
        filename: (name, ext, part) => `temp-${Date.now()}-${part.originalFilename}`,
    })

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('❌ Lỗi khi parse FormData:', err)
            return res.status(500).json({ error: 'Upload error', detail: err })
        }

        const file = files.file
        const jobId = fields.jobId?.[0] || fields.jobId

        if (!file || !jobId) {
            console.warn('⚠️ Thiếu file hoặc jobId')
            return res.status(400).json({ error: 'Thiếu file hoặc jobId' })
        }

        console.log('📁 File upload:', file.originalFilename)
        const fileStream = fs.createReadStream(file.filepath)
        const fileKey = `audio/${jobId}.mp3`

        try {
            await R2.send(
                new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME!,
                    Key: fileKey,
                    Body: fileStream,
                    ContentType: 'audio/mpeg',
                    ACL: 'public-read', // Cho phép xem công khai
                })
            )

            const publicUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`
            console.log('✅ Upload thành công:', publicUrl)

            return res.status(200).json({ success: true, url: publicUrl, key: fileKey })
        } catch (e) {
            console.error('❌ Lỗi khi upload lên R2:', (e as Error).message)
            return res.status(500).json({ error: 'R2 upload failed', detail: (e as Error).message })
        }
    })
}
