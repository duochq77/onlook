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
    console.log('🎬 MERGE Video Worker đang chạy...');
    const rawJob = await redis.lpop('ffmpeg-jobs:merge');
    if (!rawJob) {
        console.log('⏹ Không có job nào trong hàng đợi. Kết thúc worker.');
        return;
    }
    const job = rawJob;
    console.log('📦 Nhận job MERGE:', job);
    const tmpVideoPath = path_1.default.join('/tmp', 'clean-video.mp4');
    const tmpAudioPath = path_1.default.join('/tmp', 'audio.mp3');
    const tmpOutputPath = path_1.default.join('/tmp', 'merged-video.mp4');
    fs_1.default.copyFileSync(job.cleanVideo, tmpVideoPath);
    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET)
        .download(job.audio);
    if (error || !data) {
        console.error('❌ Lỗi tải audio từ Supabase:', error);
        return;
    }
    fs_1.default.writeFileSync(tmpAudioPath, Buffer.from(await data.arrayBuffer()));
    const ffmpegCmd = `ffmpeg -y -i ${tmpVideoPath} -i ${tmpAudioPath} -c:v copy -c:a aac ${tmpOutputPath}`;
    console.log('⚙️ Chạy FFmpeg:', ffmpegCmd);
    try {
        await execPromise(ffmpegCmd);
        console.log('✅ Đã ghép âm thanh vào video:', tmpOutputPath);
    }
    catch (err) {
        console.error('💥 FFmpeg lỗi:', err);
        return;
    }
    const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET)
        .upload(`outputs/${job.outputName}`, fs_1.default.readFileSync(tmpOutputPath), { upsert: true });
    if (uploadError) {
        console.error('❌ Lỗi upload video hoàn chỉnh lên Supabase:', uploadError);
        return;
    }
    console.log('🚀 Merge hoàn tất! Video đã được lưu vào Supabase.');
}
runWorker().catch(console.error);
