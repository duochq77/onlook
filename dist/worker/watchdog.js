"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWorker = runWorker;
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Khởi tạo Supabase
const supabase = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Khởi tạo Redis
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
// Hàm chạy worker xử lý job từ hàng đợi Redis
async function runWorker() {
    while (true) {
        const job = await redis.lpop('ffmpeg-jobs');
        if (!job) {
            await new Promise((r) => setTimeout(r, 1000)); // chờ 1 giây rồi kiểm tra lại
            continue;
        }
        try {
            const { inputVideo, inputAudio, outputName } = JSON.parse(job);
            const outputPath = path_1.default.join('/tmp', outputName);
            const command = `ffmpeg -i ${inputVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputPath}`;
            await execPromise(command);
            const data = fs_1.default.readFileSync(outputPath);
            await supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET)
                .upload(`outputs/${outputName}`, data, {
                contentType: 'video/mp4',
                upsert: true,
            });
            fs_1.default.unlinkSync(outputPath);
            console.log(`✅ Xử lý xong: ${outputName}`);
        }
        catch (err) {
            console.error('❌ Xử lý job thất bại:', err);
        }
    }
}
// Hàm hỗ trợ chạy lệnh shell với Promise
function execPromise(command) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
}
