// ✅ delete-merged-worker2.ts
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import fs from 'fs';
function readSecret(key) {
    try {
        return fs.readFileSync(`/mnt/secrets-store/${key}`, 'utf8').trim();
    }
    catch (err) {
        throw new Error(`❌ Lỗi đọc secret ${key}: ${err}`);
    }
}
const REDIS_HOST = readSecret('REDIS_HOST');
const REDIS_PORT = parseInt(readSecret('REDIS_PORT'));
const REDIS_PASSWORD = readSecret('REDIS_PASSWORD');
const R2_ENDPOINT = readSecret('R2_ENDPOINT');
const R2_BUCKET_NAME = readSecret('R2_BUCKET_NAME');
const R2_ACCESS_KEY_ID = readSecret('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = readSecret('R2_SECRET_ACCESS_KEY');
const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: times => Math.min(times * 200, 2000),
});
const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});
async function deleteFileFromR2(key) {
    const cmd = new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
    await s3.send(cmd);
    console.log(`🗑️ Đã xoá file: ${key}`);
}
async function startWorker() {
    console.log('🚀 delete-merged-worker2 đang chạy...');
    const ZSET_KEY = 'delete-jobs';
    while (true) {
        try {
            const now = Date.now();
            const jobs = await redis.zrangebyscore(ZSET_KEY, 0, now, 'LIMIT', 0, 10);
            if (jobs.length === 0) {
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }
            for (const key of jobs) {
                await deleteFileFromR2(key);
                await redis.zrem(ZSET_KEY, key);
            }
        }
        catch (err) {
            console.error('❌ Lỗi delete worker:', err);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}
startWorker();
