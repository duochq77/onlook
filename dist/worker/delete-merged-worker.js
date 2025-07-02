"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const ioredis_1 = __importDefault(require("ioredis"));
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET || !REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.');
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new ioredis_1.default({
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
    password: REDIS_PASSWORD,
});
async function startWorker() {
    console.log('🧼 delete-merged-worker.ts khởi động...');
    while (true) {
        const job = await redis.lpop('delete-merged-jobs');
        if (!job) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
        }
        try {
            const parsed = JSON.parse(job);
            const { filePath, expiresAt } = parsed;
            if (Date.now() < expiresAt) {
                // Chưa đến hạn xoá – đẩy lại cuối hàng đợi
                await redis.rpush('delete-merged-jobs', job);
                continue;
            }
            console.log(`🧽 Xoá file hết hạn: ${filePath}`);
            const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([filePath]);
            if (error) {
                console.error('❌ Lỗi xoá file:', error.message);
            }
            else {
                console.log('✅ Đã xoá file hoàn chỉnh khỏi Supabase.');
            }
        }
        catch (err) {
            console.error('❌ Lỗi xử lý job:', err);
        }
    }
}
startWorker().catch(console.error);
