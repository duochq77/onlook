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
const app = (0, express_1.default)();
app.use(express_1.default.json());
// 📦 Đọc biến môi trường an toàn
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
// ✅ Log kiểm tra biến môi trường
console.log('📡 SUPABASE_URL:', supabaseUrl);
console.log('🔑 SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceRole);
console.log('📦 SUPABASE_STORAGE_BUCKET:', supabaseStorageBucket);
console.log('🔐 Redis URL:', redisUrl);
console.log('🔐 Redis Token:', !!redisToken);
// ❌ Báo lỗi chi tiết nếu thiếu
if (!supabaseUrl || !supabaseServiceRole || !supabaseStorageBucket) {
    throw new Error(`❌ ENV Supabase thiếu:
    - SUPABASE_URL = ${supabaseUrl}
    - SUPABASE_SERVICE_ROLE_KEY = ${supabaseServiceRole}
    - SUPABASE_STORAGE_BUCKET = ${supabaseStorageBucket}`);
}
if (!redisUrl || !redisToken) {
    throw new Error(`❌ ENV Redis thiếu:
    - UPSTASH_REDIS_REST_URL = ${redisUrl}
    - UPSTASH_REDIS_REST_TOKEN = ${redisToken}`);
}
const redis = new redis_1.Redis({ url: redisUrl, token: redisToken });
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRole);
const TMP = '/tmp';
const QUEUE_KEY = 'onlook:job-queue';
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
            .from(supabaseStorageBucket) // ✅ thêm dấu ! để tránh lỗi undefined
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
app.get('/', (_, res) => {
    res.send('✅ Worker is alive');
});
app.post('/', (_, res) => {
    console.log('⚡ Nhận POST từ Cloud Run (kiểm tra sống)');
    res.json({ message: 'Worker OK, đang chạy job loop...' });
});
const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, () => {
    console.log(`🚀 Worker lắng nghe tại cổng ${PORT}`);
    runWorker();
});
