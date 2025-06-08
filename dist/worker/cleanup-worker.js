"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
async function cleanupFiles() {
    console.log('🧹 Cleanup Worker đang chạy...');
    const rawJob = await redis.lpop('ffmpeg-jobs:cleanup');
    if (!rawJob) {
        console.log('⏹ Không có file cần xóa. Kết thúc worker.');
        return;
    }
    const job = JSON.parse(rawJob);
    console.log('📦 Nhận job CLEANUP:', job);
    const tmpFiles = [
        path_1.default.join('/tmp', 'input.mp4'),
        path_1.default.join('/tmp', 'clean-video.mp4'),
        path_1.default.join('/tmp', 'merged-video.mp4'),
    ];
    for (const file of tmpFiles) {
        try {
            if (fs_1.default.existsSync(file)) {
                fs_1.default.unlinkSync(file);
                console.log(`✅ Đã xóa: ${file}`);
            }
        }
        catch (err) {
            console.error(`❌ Lỗi xóa file: ${file}`, err);
        }
    }
    const { error } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET)
        .remove([`outputs/${job.outputName}`]);
    if (error) {
        console.error('❌ Lỗi xóa file trên Supabase:', error);
        return;
    }
    console.log('✅ Đã xóa video hoàn chỉnh trên Supabase.');
}
cleanupFiles().catch(console.error);
