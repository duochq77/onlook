"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const stream_1 = require("stream");
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const supabase = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const TMP = '/tmp';
async function download(url, dest) {
    const res = await fetch(url);
    if (!res.ok || !res.body)
        throw new Error(`❌ Không tải được: ${url}`);
    const fileStream = fs_1.default.createWriteStream(dest);
    const nodeStream = stream_1.Readable.from(res.body);
    await new Promise((resolve, reject) => {
        nodeStream.pipe(fileStream);
        nodeStream.on('error', reject);
        fileStream.on('finish', resolve);
    });
}
async function processJob(job) {
    // Kiểm tra biến môi trường cần thiết
    if (!process.env.SUPABASE_STORAGE_BUCKET) {
        console.error('❌ Thiếu biến môi trường: SUPABASE_STORAGE_BUCKET');
        process.exit(1);
    }
    if (!job.outputName) {
        console.error('❌ Thiếu job.outputName');
        process.exit(1);
    }
    const inputVideo = path_1.default.join(TMP, 'input.mp4');
    const inputAudio = path_1.default.join(TMP, 'input.mp3');
    const cleanVideo = path_1.default.join(TMP, 'clean.mp4');
    const outputFile = path_1.default.join(TMP, job.outputName);
    console.log(`🟢 Bắt đầu xử lý job ${job.jobId}`);
    console.log("📌 outputName:", job.outputName);
    console.log("📌 SUPABASE_STORAGE_BUCKET:", process.env.SUPABASE_STORAGE_BUCKET);
    try {
        console.log('📥 Đang tải video + audio từ Supabase...');
        await download(job.videoUrl, inputVideo);
        await download(job.audioUrl, inputAudio);
        if (!fs_1.default.existsSync(inputVideo) || !fs_1.default.existsSync(inputAudio)) {
            throw new Error('❌ File tải về không tồn tại!');
        }
        console.log('✂️ Đang tách audio khỏi video...');
        (0, child_process_1.execSync)(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`);
        console.log('🎧 Đang ghép audio gốc vào video sạch...');
        (0, child_process_1.execSync)(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`);
        console.log('🚀 Upload file merged lên Supabase...');
        const uploadRes = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .upload(`outputs/${job.outputName}`, fs_1.default.createReadStream(outputFile), {
            contentType: 'video/mp4',
            upsert: true,
        });
        if (uploadRes.error) {
            throw new Error(`❌ Lỗi khi upload file merged: ${uploadRes.error.message}`);
        }
        // Xoá file nguyên liệu cũ
        const extractPath = (url) => url.split(`/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/`)[1];
        await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET).remove([extractPath(job.videoUrl)]);
        await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET).remove([extractPath(job.audioUrl)]);
        console.log(`✅ Hoàn tất job ${job.jobId}: outputs/${job.outputName}`);
    }
    catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err);
    }
}
async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy...');
    while (true) {
        try {
            const jobJson = await redis.rpop('onlook:process-video-queue');
            if (!jobJson) {
                await new Promise((r) => setTimeout(r, 3000));
                continue;
            }
            const job = JSON.parse(jobJson);
            await processJob(job);
        }
        catch (err) {
            console.error('❌ Lỗi worker:', err);
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
}
runWorker();
