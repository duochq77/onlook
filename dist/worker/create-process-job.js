"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const formidable_1 = require("formidable");
const promises_1 = __importDefault(require("fs/promises"));
const mime_types_1 = __importDefault(require("mime-types"));
const crypto_1 = require("crypto");
const redis_1 = require("redis");
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
// ✅ CORS: Cho phép mọi nguồn, xử lý preflight
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS')
        return res.status(204).end();
    next();
});
// ✅ Log biến môi trường khi khởi động
console.log('🔧 R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID);
console.log('🔧 R2_PUBLIC_BUCKET_2:', process.env.R2_PUBLIC_BUCKET_2);
console.log('🔧 REDIS_HOST:', process.env.REDIS_HOST);
// ✅ Tạo Redis client toàn cục
const redis = (0, redis_1.createClient)({
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
    password: process.env.REDIS_PASSWORD,
});
// ✅ Kết nối Redis 1 lần khi app start
redis.connect()
    .then(() => console.log('✅ Redis connected'))
    .catch((err) => {
    console.error('⚠️ Redis connect failed, vẫn tiếp tục chạy:', err.message);
});
const UPLOAD_DIR = '/tmp/uploads';
app.post('/create', async (req, res) => {
    const form = new formidable_1.IncomingForm({ uploadDir: UPLOAD_DIR, keepExtensions: true });
    try {
        await promises_1.default.mkdir(UPLOAD_DIR, { recursive: true });
        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error('❌ Form parse error:', err);
                return res.status(500).json({ error: 'Form parse error' });
            }
            try {
                const video = Array.isArray(files.video) ? files.video[0] : files.video;
                const audio = Array.isArray(files.audio) ? files.audio[0] : files.audio;
                if (!video || !audio) {
                    return res.status(400).json({ error: 'Missing files' });
                }
                const jobId = `job-${Date.now()}-${(0, crypto_1.randomUUID)().slice(0, 8)}`;
                const videoKey = `inputs/${jobId}-video.${mime_types_1.default.extension(video.mimetype) || 'mp4'}`;
                const audioKey = `inputs/${jobId}-audio.${mime_types_1.default.extension(audio.mimetype) || 'mp3'}`;
                const outputKey = `outputs/merged-${jobId}.mp4`;
                await uploadToR2(video.filepath, videoKey);
                await uploadToR2(audio.filepath, audioKey);
                if (!redis.isOpen) {
                    console.error('❌ Redis chưa sẵn sàng, không thể push job');
                    return res.status(500).json({ error: 'Redis is not connected' });
                }
                const payload = JSON.stringify({
                    videoUrl: r2PublicUrl(videoKey),
                    audioUrl: r2PublicUrl(audioKey),
                    outputKey,
                });
                await redis.zAdd('process-jobs', [{ score: Date.now(), value: payload }]);
                return res.status(200).json({ success: true, jobId, outputKey });
            }
            catch (innerErr) {
                console.error('❌ Lỗi xử lý nội dung file hoặc Redis:', innerErr);
                return res.status(500).json({ error: 'Lỗi xử lý nội dung file' });
            }
        });
    }
    catch (err) {
        console.error('❌ Tổng thể thất bại:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
async function uploadToR2(filePath, key) {
    const file = await promises_1.default.readFile(filePath);
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
    const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': file.length.toString(),
            'x-amz-acl': 'public-read',
        },
        body: file,
    });
    if (!res.ok)
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
}
function r2PublicUrl(key) {
    return `https://${process.env.R2_PUBLIC_BUCKET_2}.r2.dev/${key}`;
}
app.listen(port, () => {
    console.log(`🚀 create-process-job worker listening on port ${port}`);
});
