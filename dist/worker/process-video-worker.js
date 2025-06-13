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
const extractPath = (url) => {
    try {
        const parts = url.split(`/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/`);
        if (parts.length === 2) {
            console.log('extractPath:', parts[1]);
            return parts[1];
        }
        else {
            console.warn('⚠️ Không thể trích xuất đường dẫn đúng từ URL:', url);
            return '';
        }
    }
    catch (e) {
        console.error('❌ Lỗi trích xuất đường dẫn xóa file:', e);
        return '';
    }
};
async function download(url, dest) {
    console.log('Downloading:', url);
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
    if (!job.jobId ||
        !job.videoUrl ||
        !job.audioUrl ||
        !job.outputName) {
        console.error('❌ Thiếu trường bắt buộc trong job:', job);
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
        // Xóa file tạm sau khi hoàn thành job
        const cleanUpFiles = [inputVideo, inputAudio, cleanVideo, outputFile];
        for (const f of cleanUpFiles) {
            try {
                if (fs_1.default.existsSync(f)) {
                    fs_1.default.unlinkSync(f);
                    console.log(`✅ Đã xóa file tạm: ${f}`);
                }
            }
            catch (err) {
                console.warn(`⚠️ Lỗi khi xóa file tạm ${f}:`, err);
            }
        }
        // Xóa file nguyên liệu trên Supabase Storage
        const videoPath = extractPath(job.videoUrl);
        const audioPath = extractPath(job.audioUrl);
        if (videoPath) {
            try {
                await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET).remove([videoPath]);
                console.log(`✅ Đã xóa file video nguyên liệu: ${videoPath}`);
            }
            catch (err) {
                console.error(`❌ Lỗi xóa file video nguyên liệu ${videoPath}:`, err);
            }
        }
        if (audioPath) {
            try {
                await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET).remove([audioPath]);
                console.log(`✅ Đã xóa file audio nguyên liệu: ${audioPath}`);
            }
            catch (err) {
                console.error(`❌ Lỗi xóa file audio nguyên liệu ${audioPath}:`, err);
            }
        }
        console.log(`✅ Hoàn tất job ${job.jobId}: outputs/${job.outputName}`);
    }
    catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err);
        // Dù lỗi vẫn xóa file tạm
        const cleanUpFiles = [inputVideo, inputAudio, cleanVideo, outputFile];
        for (const f of cleanUpFiles) {
            try {
                if (fs_1.default.existsSync(f)) {
                    fs_1.default.unlinkSync(f);
                    console.log(`✅ Đã xóa file tạm: ${f}`);
                }
            }
            catch (err) {
                console.warn(`⚠️ Lỗi khi xóa file tạm ${f}:`, err);
            }
        }
    }
}
async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy...');
    const jobId = process.env.JOB_ID;
    if (!jobId) {
        console.error('❌ Thiếu biến môi trường JOB_ID!');
        process.exit(1);
    }
    console.log('🟢 Worker nhận JOB_ID:', jobId);
    try {
        const jobJson = await redis.hget('onlook:jobs', jobId);
        if (!jobJson) {
            console.error(`❌ Không tìm thấy job ${jobId} trong Redis!`);
            process.exit(1);
        }
        const job = JSON.parse(jobJson);
        await processJob(job);
        // Xóa job sau khi xử lý xong
        await redis.hdel('onlook:jobs', jobId);
        console.log(`✅ Đã xóa job ${jobId} khỏi Redis`);
        console.log('✅ Worker hoàn thành job, thoát...');
        process.exit(0);
    }
    catch (err) {
        console.error('❌ Lỗi worker:', err);
        process.exit(1);
    }
}
runWorker();
