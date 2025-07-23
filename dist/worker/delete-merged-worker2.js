"use strict";
// ✅ delete-merged-worker2.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const ioredis_1 = __importDefault(require("ioredis"));
const fs_1 = __importDefault(require("fs"));
function readSecret(key) {
    try {
        return fs_1.default.readFileSync(`/mnt/secrets-store/${key}`, 'utf8').trim();
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
const redis = new ioredis_1.default({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: times => Math.min(times * 200, 2000),
});
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});
async function deleteFileFromR2(key) {
    const cmd = new client_s3_1.DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
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
