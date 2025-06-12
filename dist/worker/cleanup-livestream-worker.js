"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
async function cleanupLivestreamFiles() {
    console.log('🧹 Cleanup Livestream Worker đang chạy...');
    const keys = await redis.keys('livestream:end:*');
    if (!keys.length) {
        console.log('⏹ Không có livestream cần xóa. Kết thúc worker.');
        return;
    }
    for (const key of keys) {
        const outputName = key.replace('livestream:end:', '');
        // Xóa file trên Supabase
        const { error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .remove([`outputs/${outputName}`]);
        if (error) {
            console.error(`❌ Lỗi xóa file livestream (${outputName}) trên Supabase:`, error);
            continue;
        }
        console.log(`✅ Đã xóa file livestream: ${outputName}`);
        // Xóa key khỏi Redis
        await redis.del(key);
    }
    console.log('🧹 Cleanup Livestream hoàn tất.');
}
cleanupLivestreamFiles().catch(console.error);
