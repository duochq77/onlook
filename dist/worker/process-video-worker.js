"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const stream_1 = require("stream");
// 🚀 Khởi tạo Express app
const app = (0, express_1.default)();
app.use(express_1.default.json());
// 📦 Biến môi trường
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
// ✅ Log kiểm tra biến môi trường (rất quan trọng để debug)
console.log('📡 SUPABASE_URL:', supabaseUrl);
console.log('🔑 SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceRole);
console.log('📦 SUPABASE_STORAGE_BUCKET:', supabaseStorageBucket);
console.log('🔐 Redis URL:', redisUrl);
console.log('🔐 Redis Token:', redisToken);
// ✅ Kiểm tra biến môi trường
if (!supabaseUrl || !supabaseServiceRole || !supabaseStorageBucket) {
    throw new Error('❌ Thiếu biến Supabase – kiểm tra SUPABASE_URL / SERVICE_ROLE_KEY / STORAGE_BUCKET');
}
if (!redisUrl || !redisToken) {
    throw new Error('❌ Thiếu biến Redis – kiểm tra UPSTASH_REDIS_REST_URL / ...TOKEN');
}
// 🎯 Khởi tạo client
const redis = new redis_1.Redis({ url: redisUrl, token: redisToken });
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRole);
const TMP = '/tmp';
const QUEUE_KEY = 'onlook:job-queue';
// ---------- Helpers ----------
async function download(url, dest) {
    const res = await fetch(url);
    console.log(`🌐 Tải: ${url} → status: ${res.status}`);
    if (!res.ok || !res.body)
        throw new Error(`❌ Không tải được file: ${url}`);
    const fileStream = fs_1.default.createWriteStream(dest);
    const nodeStream = stream_1.Readable.from(res.body);
    await new Promise((resolve, reject) => {
        nodeStream.pipe(fileStream);
        nodeStream.on('error', reject);
        fileStream.on('finish', resolve);
    });
}
function checkFileSize(filePath) {
    try {
        return fs_1.default.statSync(filePath).size > 0;
    }
    catch {
        return false;
    }
}
function extractPath(url) {
    const parts = url.split(`/storage/v1/object/public/${supabaseStorageBucket}/`);
    return parts[1] || '';
}
// ---------- Xử lý job ----------
async function processJob(job) {
    console.log('📌 Xử lý job:', job.jobId);
    const basePath = path_1.default.join(TMP, job.jobId);
    fs_1.default.mkdirSync(basePath, { recursive: true });
    const inputVideo = path_1.default.join(basePath, 'input.mp4');
    const inputAudio = path_1.default.join(basePath, 'input.mp3');
    const cleanVideo = path_1.default.join(basePath, 'clean.mp4');
    const outputFile = path_1.default.join(basePath, job.outputName);
    try {
        console.log('📥 Tải file...');
        await download(job.videoUrl, inputVideo);
        await download(job.audioUrl, inputAudio);
        if (!checkFileSize(inputVideo) || !checkFileSize(inputAudio)) {
            throw new Error('❌ File tải về dung lượng 0');
        }
        console.log('✂️ Tách audio gốc...');
        (0, child_process_1.execSync)(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`);
        console.log('🎧 Ghép audio mới...');
        (0, child_process_1.execSync)(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`);
        console.log('📤 Upload kết quả...');
        const { error } = await supabase.storage
            .from(supabaseStorageBucket)
            .upload(`${job.jobId}/outputs/${job.outputName}`, fs_1.default.createReadStream(outputFile), {
            contentType: 'video/mp4',
            upsert: true,
        });
        if (error)
            throw new Error('Lỗi upload: ' + error.message);
        console.log('🧹 Dọn file local...');
        fs_1.default.rmSync(basePath, { recursive: true, force: true });
        console.log('🧼 Xoá file gốc Supabase...');
        const vPath = extractPath(job.videoUrl);
        const aPath = extractPath(job.audioUrl);
        if (vPath)
            await supabase.storage.from(supabaseStorageBucket).remove([vPath]);
        if (aPath)
            await supabase.storage.from(supabaseStorageBucket).remove([aPath]);
        console.log(`✅ Xong job ${job.jobId}`);
    }
    catch (err) {
        console.error(`❌ Lỗi job ${job.jobId}:`, err);
    }
}
// ---------- Worker loop ----------
async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy, chờ job...');
    while (true) {
        try {
            const jobStr = await redis.rpop(QUEUE_KEY);
            if (!jobStr) {
                await new Promise((r) => setTimeout(r, 1000));
                continue;
            }
            const job = typeof jobStr === 'string' ? JSON.parse(jobStr) : jobStr;
            await processJob(job);
        }
        catch (err) {
            console.error('❌ Lỗi worker:', err);
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
}
// ---------- HTTP endpoints ----------
app.get('/', (_, res) => {
    res.send('✅ Worker is alive');
});
app.post('/', (_, res) => {
    console.log('⚡ Nhận POST từ Cloud Run (kiểm tra sống)');
    res.json({ message: 'Worker OK, đang chạy job loop...' });
});
// ---------- Start server ----------
const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, () => {
    console.log(`🚀 Worker lắng nghe tại cổng ${PORT}`);
    runWorker();
});
