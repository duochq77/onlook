"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
const execPromise = util_1.default.promisify(child_process_1.exec);
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
async function runWorker() {
    console.log('🎬 CLEAN Video Worker đang chạy...');
    try {
        // 🔥 Kiểm tra kết nối Redis trước khi lấy job
        const testKey = 'redis-test';
        await redis.set(testKey, 'connected');
        const redisStatus = await redis.get(testKey);
        console.log('🛠️ Kiểm tra kết nối Redis:', redisStatus);
        const rawJob = await redis.lpop('ffmpeg-jobs:clean');
        if (!rawJob) {
            console.log('⏹ Không có job nào trong hàng đợi. Kết thúc worker.');
            return;
        }
        const job = JSON.parse(rawJob);
        console.log('📦 Nhận job CLEAN:', job);
        const tmpInputPath = path_1.default.join('/tmp', 'input.mp4');
        const tmpOutputPath = path_1.default.join('/tmp', 'clean-video.mp4');
        // 🛠️ Tải video từ Supabase
        console.log('📥 Đang tải video từ Supabase:', job.inputVideo);
        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .download(job.inputVideo);
        if (error || !data) {
            console.error('❌ Lỗi tải video từ Supabase:', error);
            return;
        }
        fs_1.default.writeFileSync(tmpInputPath, Buffer.from(await data.arrayBuffer()));
        // ⚙️ Chạy FFmpeg để làm sạch video
        const ffmpegCmd = `ffmpeg -y -i ${tmpInputPath} -an -c:v copy ${tmpOutputPath}`;
        console.log('🎬 Chạy FFmpeg:', ffmpegCmd);
        try {
            await execPromise(ffmpegCmd);
            console.log('✅ Đã tạo video sạch:', tmpOutputPath);
        }
        catch (err) {
            console.error('💥 FFmpeg lỗi:', err);
            return;
        }
        // 📤 Upload lại lên Supabase
        console.log('🚀 Đang upload video sạch lên Supabase...');
        const { error: uploadError } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .upload(`outputs/${job.outputName}`, fs_1.default.readFileSync(tmpOutputPath), { upsert: true });
        if (uploadError) {
            console.error('❌ Lỗi upload video sạch lên Supabase:', uploadError);
            return;
        }
        console.log('✅ Worker đã hoàn thành job:', job.outputName);
    }
    catch (err) {
        console.error('💥 Worker lỗi:', err);
    }
}
runWorker().catch(console.error);
