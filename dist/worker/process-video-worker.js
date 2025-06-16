"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = process.env.PORT || 8080;
// 🔐 Kiểm tra biến môi trường
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseStorageBucket || !redisUrl || !redisToken) {
    console.error('❌ Thiếu biến môi trường bắt buộc.');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
const redis = new redis_1.Redis({ url: redisUrl, token: redisToken });
async function downloadFile(url, dest) {
    const res = await (0, node_fetch_1.default)(url);
    if (!res.ok)
        throw new Error(`Tải file lỗi: ${url}`);
    const fileStream = fs_1.default.createWriteStream(dest);
    await new Promise((resolve, reject) => {
        if (!res.body)
            return reject(new Error('❌ Không có body khi tải file.'));
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', () => resolve(undefined));
    });
}
async function processJob(job) {
    if (!job?.jobId || !job?.videoUrl || !job?.audioUrl || !job?.outputName) {
        throw new Error(`❌ Job không hợp lệ: ${JSON.stringify(job)}`);
    }
    console.log(`📌 Xử lý job: ${job.jobId}`);
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'job-'));
    const videoPath = path_1.default.join(tmpDir, 'input.mp4');
    const audioPath = path_1.default.join(tmpDir, 'input.mp3');
    const outputPath = path_1.default.join(tmpDir, job.outputName);
    console.log('📥 Tải file...');
    await downloadFile(job.videoUrl, videoPath);
    await downloadFile(job.audioUrl, audioPath);
    console.log('🎬 Ghép audio...');
    await new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(videoPath)
            .input(audioPath)
            .outputOptions('-c:v copy', '-c:a aac', '-shortest')
            .on('end', resolve)
            .on('error', reject)
            .save(outputPath);
    });
    if (!fs_1.default.existsSync(outputPath))
        throw new Error('❌ Ghép audio thất bại: Không có file output.');
    console.log('📤 Upload kết quả...');
    const buffer = fs_1.default.readFileSync(outputPath);
    const { error } = await supabase.storage
        .from(supabaseStorageBucket)
        .upload(`outputs/${job.outputName}`, buffer, {
        contentType: 'video/mp4',
        upsert: true,
    });
    if (error)
        throw new Error('Lỗi upload: ' + error.message);
    console.log('🧹 Dọn dẹp file gốc trên Supabase...');
    const videoKey = `input-videos/input-${job.jobId}.mp4`;
    const audioKey = `input-audios/input-${job.jobId}.mp3`;
    await supabase.storage.from(supabaseStorageBucket).remove([videoKey, audioKey]);
    fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`✅ Hoàn tất job ${job.jobId}`);
}
app.post('/', async (req, res) => {
    console.log('⚡ Nhận POST từ Cloud Run');
    console.log('📦 Payload nhận được:', req.body);
    res.status(200).json({ ok: true });
    try {
        const job = req.body;
        await processJob(job);
    }
    catch (err) {
        console.error(`❌ Lỗi job ${req.body?.jobId || 'unknown'}:`, err);
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Worker lắng nghe tại cổng ${PORT}`);
    console.log('⏳ Worker Onlook đang chạy, chờ job...');
});
