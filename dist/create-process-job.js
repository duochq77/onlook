import express from 'express';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import formidable from 'formidable';
import fs from 'fs';
dotenv.config();
const app = express();
const port = process.env.PORT || 8080;
// Kiểm tra biến môi trường bắt buộc
const requiredEnv = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'R2_BUCKET_NAME', 'R2_ACCOUNT_ID'];
for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`❌ Missing required env: ${key}`);
    }
}
// Khởi tạo Redis
const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
});
redis.on('error', (err) => {
    console.error('❌ Redis error:', err);
});
app.post('/create', async (req, res) => {
    const form = formidable({ multiples: false, keepExtensions: true });
    form.parse(req, async (err, fields, files) => {
        try {
            if (err)
                throw err;
            const videoFile = Array.isArray(files.video) ? files.video[0] : files.video;
            const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
            if (!videoFile || !audioFile) {
                return res.status(400).json({ error: 'Thiếu file video hoặc audio' });
            }
            const id = Date.now();
            const unique = Math.random().toString(36).substring(2, 8);
            const baseName = `merged-${id}-${unique}.mp4`;
            const videoKey = `inputs/${id}-${unique}-video.mp4`;
            const audioKey = `inputs/${id}-${unique}-audio.mp3`;
            const outputKey = `outputs/${baseName}`;
            await uploadToR2(videoFile.filepath, videoKey);
            await uploadToR2(audioFile.filepath, audioKey);
            const job = {
                id,
                videoKey,
                audioKey,
                outputKey,
            };
            await redis.zadd('process-jobs', Date.now(), JSON.stringify(job));
            return res.json({ success: true, outputKey });
        }
        catch (error) {
            console.error('❌ Job failed:', error);
            return res.status(500).json({ error: 'Xử lý thất bại' });
        }
    });
});
async function uploadToR2(localFilePath, key) {
    const fileBuffer = await fs.promises.readFile(localFilePath);
    const uploadUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${key}`;
    const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/octet-stream',
            'x-amz-acl': 'public-read',
        },
        body: fileBuffer,
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Upload failed ${res.status}: ${errText}`);
    }
    console.log(`✅ Uploaded to R2: ${key}`);
}
app.listen(port, () => {
    console.log(`🚀 create-process-job worker listening on port ${port}`);
    console.log(`🌐 R2_ACCOUNT_ID: ${process.env.R2_ACCOUNT_ID}`);
    console.log(`🌐 R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME}`);
    console.log(`🌐 REDIS_HOST: ${process.env.REDIS_HOST}`);
});
