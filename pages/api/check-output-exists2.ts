// ✅ check-output-exists2.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.NEXT_PUBLIC_R2_BUCKET!
const ENDPOINT = process.env.NEXT_PUBLIC_R2_ENDPOINT!

const client = new S3Client({
    region: 'auto',
    endpoint: ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

    const { jobId } = req.query
    if (!jobId || typeof jobId !== 'string') return res.status(400).json({ error: 'Missing jobId' })

    const outputName = `outputs/merged-${jobId}.mp4`

    try {
        const headCmd = new HeadObjectCommand({ Bucket: BUCKET, Key: outputName })
        await client.send(headCmd)
        const fileUrl = `${ENDPOINT}/${outputName}`
        return res.status(200).json({ exists: true, downloadUrl: fileUrl })
    } catch (err: any) {
        if (err.$metadata?.httpStatusCode === 404) return res.status(200).json({ exists: false })
        console.error('❌ Lỗi check-output:', err)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}