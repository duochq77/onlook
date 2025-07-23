"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const ioredis_1 = __importDefault(require("ioredis"));
const fs_1 = __importDefault(require("fs"));
// ✅ Đọc secrets từ CSI Driver (GKE Autopilot)
function readSecret(key) {
    try {
        return fs_1.default.readFileSync(`/mnt/secrets-store/${key}`, 'utf8').trim();
    }
    catch (err) {
        throw new Error(`❌ Lỗi đọc secret ${key}: ${err}`);
    }
}
// 🔐 Đọc từ secret mount
const REDIS_HOST = readSecret('REDIS_HOST');
const REDIS_PORT = parseInt(readSecret('REDIS_PORT'));
const REDIS_PASSWORD = readSecret('REDIS_PASSWORD');
const R2_ENDPOINT = readSecret('R2_ENDPOINT');
const R2_BUCKET_NAME = readSecret('R2_BUCKET_NAME');
const R2_ACCESS_KEY_ID = readSecret('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = readSecret('R2_SECRET_ACCESS_KEY');
const ZSET_KEY = 'delete-jobs';
// ✅ Kết nối Redis (TCP + TLS)
const redis = new ioredis_1.default({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: times => Math.min(times * 200, 2000),
});
// ✅ Cấu hình client Cloudflare R2
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});
async function deleteFileFromR2(key) {
    const cmd = new client_s3_1.DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });
    await s3.send(cmd);
    console.log(`🗑️ Đã xoá file khỏi R2: ${key}`);
}
async function startWorker() {
    console.log('🚀 Worker delete-merged-worker2 đang chạy...');
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
            console.error('❌ Lỗi trong worker:', err);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}
startWorker();
