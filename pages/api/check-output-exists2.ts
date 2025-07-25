import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import Redis from 'ioredis'

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!

const REDIS_HOST = process.env.REDIS_HOST!
const REDIS_PORT = parseInt(process.env.REDIS_PORT!)
const REDIS_USERNAME = process.env.REDIS_USERNAME!
const REDIS_PASSWORD = process.env.REDIS_PASSWORD!

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: (times) => Math.min(times * 200, 2000),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        console.log('❌ Method không hợp lệ:', req.method)
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { outputName } = req.query

    if (!outputName || typeof outputName !== 'string') {
        console.log('❌ Thiếu hoặc sai định dạng outputName:', outputName)
        return res.status(400).json({ error: 'Thiếu hoặc sai định dạng outputName' })
    }

    const fileKey = `outputs/${outputName}`
    console.log('🔎 Kiểm tra sự tồn tại file R2:', fileKey)

    try {
        await r2.send(new HeadObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileKey,
        }))

        console.log('✅ File tồn tại trên R2:', fileKey)

        const downloadUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileKey}`

        // ✅ Ghi job vào Redis để xóa sau 5 phút
        const expiresAt = Date.now() + 5 * 60 * 1000
        await redis.lpush('delete-merged-jobs', JSON.stringify({
            filePath: fileKey,
            expiresAt,
        }))
        console.log(`🕓 Đã tạo job xoá sau 5 phút cho: ${fileKey}`)

        return res.status(200).json({
            exists: true,
            downloadUrl,
        })
    } catch (err: any) {
        if (err.name === 'NotFound') {
            console.log('🚫 File không tồn tại:', fileKey)
            return res.status(200).json({ exists: false })
        }

        console.error('❌ Lỗi kiểm tra file:', err)
        return res.status(500).json({ error: 'Lỗi khi kiểm tra file trên R2' })
    }
}
