import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' })

    const { key } = req.body
    if (!key) return res.status(400).json({ error: 'Thiếu key để xoá file' })

    try {
        await R2.send(
            new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
            })
        )
        return res.status(200).json({ success: true })
    } catch (err) {
        return res.status(500).json({ error: 'Xoá file thất bại', detail: (err as Error).message })
    }
}
