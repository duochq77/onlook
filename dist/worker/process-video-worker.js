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
// ==== Bước 1: Log biến môi trường để debug ====
console.log('--- DEBUG ENV VARIABLES ---');
console.log('NEXT_PUBLIC_SUPABASE_URL =', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY =', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'OK' : 'MISSING');
console.log('SUPABASE_STORAGE_BUCKET =', process.env.SUPABASE_STORAGE_BUCKET);
console.log('UPSTASH_REDIS_REST_URL =', process.env.UPSTASH_REDIS_REST_URL);
console.log('UPSTASH_REDIS_REST_TOKEN =', process.env.UPSTASH_REDIS_REST_TOKEN ? 'OK' : 'MISSING');
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const supabase = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const TMP = '/tmp';
if (!fs_1.default.existsSync(TMP)) {
    console.error('❌ Thư mục /tmp không tồn tại hoặc không thể ghi!');
    process.exit(1);
}
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
const checkFileSize = (filePath) => {
    try {
        const stats = fs_1.default.statSync(filePath);
        return stats.size > 0;
    }
    catch {
        return false;
    }
};
async function processJob(job) {
    console.log('📌 Debug: job nhận từ Redis =', job);
    // Kiểm tra kiểu dữ liệu job và outputName
    console.log('🔍 Kiểu dữ liệu job:', typeof job);
    console.log('🔍 Kiểm tra outputName:', job.outputName, typeof job.outputName);
    if (!job.outputName || typeof job.outputName !== 'string') {
        console.error('❌ outputName không hợp lệ hoặc thiếu:', job.outputName);
        return;
    }
    if (!job.videoUrl ||
        !job.audioUrl ||
        !process.env.SUPABASE_STORAGE_BUCKET) {
        console.error('❌ Thiếu giá trị job hoặc biến môi trường! Dừng Worker.');
        process.exit(1);
    }
    // ==== Bước 2: Kiểm tra TMP luôn phải là string hợp lệ ====
    if (typeof TMP !== 'string' || TMP.length === 0) {
        console.error('❌ Biến TMP không hợp lệ:', TMP);
        process.exit(1);
    }
    const inputVideo = path_1.default.join(TMP, 'input.mp4');
    const inputAudio = path_1.default.join(TMP, 'input.mp3');
    const cleanVideo = path_1.default.join(TMP, 'clean.mp4');
    const outputFile = path_1.default.join(TMP, job.outputName);
    try {
        console.log('📥 Đang tải video + audio từ Supabase...');
        await download(job.videoUrl, inputVideo);
        await download(job.audioUrl, inputAudio);
        console.log('📌 Kiểm tra file tồn tại trên Worker:');
        console.log('📌 inputVideo:', fs_1.default.existsSync(inputVideo));
        console.log('📌 inputAudio:', fs_1.default.existsSync(inputAudio));
        console.log('📌 Kiểm tra dung lượng file:');
        console.log('📌 inputVideo kích thước:', checkFileSize(inputVideo) ? 'OK' : 'Không hợp lệ');
        console.log('📌 inputAudio kích thước:', checkFileSize(inputAudio) ? 'OK' : 'Không hợp lệ');
        if (!fs_1.default.existsSync(inputVideo) || !fs_1.default.existsSync(inputAudio)) {
            throw new Error('❌ File tải về không tồn tại!');
        }
        if (!checkFileSize(inputVideo) || !checkFileSize(inputAudio)) {
            throw new Error('❌ File tải về có dung lượng 0, không hợp lệ!');
        }
        console.log('✂️ Đang tách audio khỏi video...');
        (0, child_process_1.execSync)(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`);
        console.log('🎧 Đang ghép audio gốc vào video sạch...');
        (0, child_process_1.execSync)(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`);
        console.log('📌 Upload lên Supabase...');
        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .upload(`outputs/${job.outputName}`, fs_1.default.createReadStream(outputFile), {
            contentType: 'video/mp4',
            upsert: true,
        });
        if (error) {
            console.error('❌ Lỗi upload file merged:', error.message);
            throw error;
        }
        else {
            console.log('✅ File uploaded thành công:', data);
        }
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
            let job;
            try {
                job = JSON.parse(jobJson);
            }
            catch (parseErr) {
                console.error('❌ Job nhận từ Redis không hợp lệ:', jobJson);
                continue;
            }
            if (!job || typeof job !== 'object') {
                console.error('❌ Job nhận từ Redis bị lỗi hoặc không hợp lệ:', job);
                continue;
            }
            await processJob(job);
        }
        catch (err) {
            console.error('❌ Lỗi worker:', err);
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
}
runWorker();
