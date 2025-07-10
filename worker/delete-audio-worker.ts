import express from 'express'
import cors from 'cors'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

const app = express()
app.use(cors())
app.use(express.json())

const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

app.post('/delete', async (req, res) => {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: 'Thiếu key file' })

    try {
        await R2.send(
            new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
            })
        )
        return res.status(200).json({ success: true })
    } catch (e: any) {
        return res.status(500).json({ error: 'Delete failed', detail: e.message })
    }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
    console.log(`🧼 Delete Audio Worker running on port ${PORT}`)
})
