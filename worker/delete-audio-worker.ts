import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import express from 'express'

const app = express()
const port = process.env.PORT || 8080

app.use(express.json())

// ✅ Cấu hình kết nối Cloudflare R2
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
    }
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME!

app.post('/delete', async (req, res) => {
    const { key } = req.body

    if (!key) {
        return res.status(400).json({ success: false, error: 'Thiếu key file để xoá.' })
    }

    try {
        console.log('🗑️ Đang xoá file MP3:', key)

        await s3.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        }))

        console.log('✅ Đã xoá thành công:', key)
        res.status(200).json({ success: true, message: 'Đã xoá thành công' })
    } catch (error) {
        console.error('❌ Lỗi xoá file:', error)
        res.status(500).json({ success: false, error: 'Xoá thất bại', detail: String(error) })
    }
})

app.listen(port, () => {
    console.log(`🚀 Delete Audio Worker running on port ${port}`)
})
