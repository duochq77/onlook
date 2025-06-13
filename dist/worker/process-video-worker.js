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
const stream_1 = require("stream");
// Đọc biến môi trường truyền lên chứa jobPayload JSON string
const rawJobPayload = process.env.JOB_PAYLOAD;
if (!rawJobPayload) {
    console.error('❌ Thiếu biến môi trường JOB_PAYLOAD chứa dữ liệu job');
    process.exit(1);
}
let job;
try {
    job = JSON.parse(rawJobPayload);
}
catch {
    console.error('❌ JOB_PAYLOAD không hợp lệ JSON:', rawJobPayload);
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const TMP = '/tmp';
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
async function processJob() {
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
        // Dọn file tạm
        ;
        [inputVideo, inputAudio, cleanVideo, outputFile].forEach(f => {
            if (fs_1.default.existsSync(f)) {
                try {
                    fs_1.default.unlinkSync(f);
                    console.log(`✅ Đã xóa file tạm: ${f}`);
                }
                catch (e) {
                    console.warn(`⚠️ Lỗi khi xóa file tạm ${f}:`, e);
                }
            }
        });
        console.log(`✅ Hoàn tất job ${job.jobId}: outputs/${job.outputName}`);
    }
    catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err);
        process.exit(1);
    }
}
processJob();
