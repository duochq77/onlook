import express from 'express'
import cors from 'cors'
import { IncomingForm, File } from 'formidable'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

const app = express()
const port = process.env.PORT || 8080

app.use(cors())
app.options('*', cors())

// ✅ Cấu hình kết nối Cloudflare R2
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
    }
})

app.post('/upload', (req, res) => {
    const form = new IncomingForm({ multiples: false, keepExtensions: true })

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('❌ Lỗi parse form:', err)
            return res.status(500).json({ success: false, error: 'Lỗi xử lý form dữ liệu.' })
        }

        try {
            console.log('📤 Bắt đầu upload file MP3:', files.file)

            if (!files.file) {
                return res.status(400).json({ success: false, error: 'Không có file được upload.' })
            }

            const file = Array.isArray(files.file)
                ? files.file[0]
                : files.file as File

            const fileStream = fs.createReadStream(file.filepath)
            const fileName = `${Date.now()}-${file.originalFilename}`

            const uploadParams = {
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: fileName,
                Body: fileStream,
                ContentType: file.mimetype || 'audio/mpeg'
            }

            await s3.send(new PutObjectCommand(uploadParams))

            const url = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileName}`

            console.log('✅ Upload thành công:', fileName)
            res.status(200).json({
                success: true,
                message: 'Upload thành công',
                fileName,
                key: fileName,
                url
            })
        } catch (error) {
            console.error('❌ Upload thất bại:', error)
            res.status(500).json({ success: false, error: 'Upload thất bại', detail: String(error) })
        }
    })
})

app.listen(port, () => {
    console.log(`🚀 Upload Audio Worker running on port ${port}`)
})
