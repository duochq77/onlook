import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import fs from 'fs';
import express from 'express';
import fetch from 'node-fetch';
// 📁 Đọc secrets từ CSI
const readSecret = (key) => {
    try {
        return fs.readFileSync(`/mnt/secrets-store/${key}`, 'utf8').trim();
    }
    catch (e) {
        throw new Error(`❌ Lỗi đọc secret ${key}: ${e}`);
    }
};
const SUPABASE_URL = readSecret('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = readSecret('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_STORAGE_BUCKET = readSecret('SUPABASE_STORAGE_BUCKET');
const REDIS_HOST = readSecret('REDIS_HOST');
const REDIS_PORT = readSecret('REDIS_PORT');
const REDIS_PASSWORD = readSecret('REDIS_PASSWORD');
const PORT = readSecret('PORT') || '8080';
// 🔐 Kiểm tra log biến môi trường
console.log('🔐 SUPABASE_SERVICE_ROLE_KEY bắt đầu bằng:', SUPABASE_SERVICE_ROLE_KEY.slice(0, 20) + '...');
console.log('🔐 SUPABASE_URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {}, // bắt buộc với Upstash
    retryStrategy: (times) => Math.min(times * 200, 2000),
});
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const processJob = async (jobRaw) => {
    try {
        const { filePath, expiresAt } = JSON.parse(jobRaw);
        if (!filePath || !expiresAt) {
            console.warn('⚠️ Job không hợp lệ:', jobRaw);
            return;
        }
        const now = Date.now();
        if (now < expiresAt) {
            console.log(`⏳ Chưa đến hạn xoá file: ${filePath} (còn ${((expiresAt - now) / 1000).toFixed(0)}s)`);
            await redis.rpush('delete-merged-jobs', jobRaw);
            return;
        }
        console.log(`🧽 Xoá file hết hạn: ${filePath}`);
        const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${filePath}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
        });
        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ Lỗi xoá file ${filePath}:`, response.status, text);
        }
        else {
            console.log(`✅ Đã xoá file hoàn chỉnh khỏi Supabase: ${filePath}`);
        }
    }
    catch (err) {
        console.error('❌ Lỗi xử lý job xoá file:', err);
    }
};
const startWorker = async () => {
    console.log('🧼 delete-merged-worker.ts khởi động...');
    while (true) {
        try {
            const jobRaw = await redis.lpop('delete-merged-jobs');
            if (jobRaw) {
                await processJob(jobRaw);
            }
            else {
                await delay(5000);
            }
        }
        catch (err) {
            console.error('❌ Lỗi trong vòng lặp worker:', err);
            await delay(5000);
        }
    }
};
startWorker().catch(console.error);
// 🟢 Express để kiểm tra trạng thái sống
const app = express();
app.get('/', (_req, res) => res.send('🟢 delete-merged-worker đang chạy'));
app.listen(Number(PORT), () => {
    console.log(`🌐 delete-merged-worker lắng nghe tại PORT ${PORT}`);
});
