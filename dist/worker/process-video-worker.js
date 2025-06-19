"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const ioredis_1 = __importDefault(require("ioredis"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
console.log('🚀 process-video-worker.ts khởi động...');
// 🔐 Biến môi trường
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, PORT = 8080 } = process.env;
// 🧪 Kiểm tra biến môi trường
console.log('🔍 SUPABASE_URL =', SUPABASE_URL);
console.log('🔍 SUPABASE_SERVICE_ROLE_KEY =', !!SUPABASE_SERVICE_ROLE_KEY);
console.log('🔍 SUPABASE_STORAGE_BUCKET =', SUPABASE_STORAGE_BUCKET);
console.log('🔍 REDIS_HOST =', REDIS_HOST);
console.log('🔍 REDIS_PORT =', REDIS_PORT);
console.log('🔍 REDIS_PASSWORD =', !!REDIS_PASSWORD);
if (!SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !SUPABASE_STORAGE_BUCKET ||
    !REDIS_HOST ||
    !REDIS_PORT ||
    !REDIS_PASSWORD) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.');
}
// 🔌 Supabase + Redis TCP
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new ioredis_1.default({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {} // Bắt buộc cho Upstash TCP
});
// 📥 Tải file từ URL
const downloadFile = async (url, dest) => {
    const res = await (0, node_fetch_1.default)(url);
    if (!res.ok)
        throw new Error(`❌ Không tải được file: ${url}`);
    const fileStream = fs_1.default.createWriteStream(dest);
    await new Promise((resolve, reject) => {
        res.body?.pipe(fileStream);
        res.body?.on('error', reject);
        fileStream.on('finish', () => resolve());
    });
};
// ⏱ Thời lượng media
const getDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
            if (err)
                return reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
};
// 🔁 Lặp media
const loopMedia = (input, output, duration) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(input)
            .inputOptions('-stream_loop', '-1')
            .outputOptions('-t', `${duration}`)
            .save(output)
            .on('end', () => resolve())
            .on('error', reject);
    });
};
// ✂️ Cắt media
const cutMedia = (input, output, duration) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(input)
            .setDuration(duration)
            .save(output)
            .on('end', () => resolve())
            .on('error', reject);
    });
};
// 🧠 Xử lý job
const processJob = async (job) => {
    console.log(`📦 Bắt đầu xử lý job ${job.jobId}`);
    const tmpDir = path_1.default.join(os_1.default.tmpdir(), `onlook-${job.jobId}`);
    fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    fs_1.default.mkdirSync(tmpDir);
    const inputVideo = path_1.default.join(tmpDir, 'input.mp4');
    const inputAudio = path_1.default.join(tmpDir, 'input.mp3');
    const cleanVideo = path_1.default.join(tmpDir, 'clean.mp4');
    const finalVideo = path_1.default.join(tmpDir, 'final.mp4');
    const finalAudio = path_1.default.join(tmpDir, 'final.mp3');
    const mergedOutput = path_1.default.join(tmpDir, 'output.mp4');
    try {
        await downloadFile(job.videoUrl, inputVideo);
        await downloadFile(job.audioUrl, inputAudio);
        await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input(inputVideo)
                .noAudio()
                .save(cleanVideo)
                .on('end', () => resolve())
                .on('error', reject);
        });
        const videoDur = await getDuration(cleanVideo);
        const audioDur = await getDuration(inputAudio);
        console.log(`⏱ Duration: video = ${videoDur}, audio = ${audioDur}`);
        if (Math.abs(videoDur - audioDur) < 1) {
            fs_1.default.copyFileSync(cleanVideo, finalVideo);
            fs_1.default.copyFileSync(inputAudio, finalAudio);
        }
        else if (videoDur < audioDur) {
            await loopMedia(cleanVideo, finalVideo, audioDur);
            await cutMedia(finalVideo, finalVideo, audioDur);
            fs_1.default.copyFileSync(inputAudio, finalAudio);
        }
        else if (videoDur > audioDur && videoDur / audioDur < 1.2) {
            await cutMedia(cleanVideo, finalVideo, audioDur);
            fs_1.default.copyFileSync(inputAudio, finalAudio);
        }
        else {
            fs_1.default.copyFileSync(cleanVideo, finalVideo);
            await loopMedia(inputAudio, finalAudio, videoDur);
            await cutMedia(finalAudio, finalAudio, videoDur);
        }
        await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input(finalVideo)
                .input(finalAudio)
                .outputOptions('-c:v copy', '-c:a aac', '-shortest')
                .save(mergedOutput)
                .on('end', () => resolve())
                .on('error', reject);
        });
        const buffer = fs_1.default.readFileSync(mergedOutput);
        const outputPath = `outputs/${job.outputName}`;
        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(outputPath, buffer, {
            upsert: true,
            contentType: 'video/mp4'
        });
        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`
        ]);
    }
    catch (err) {
        console.error(`❌ Lỗi job ${job.jobId}:`, err);
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
        console.log(`🧽 Dọn RAM job ${job.jobId}`);
    }
};
// 🔄 Vòng lặp worker
const startWorker = async () => {
    console.log('👷 Worker nền đang chạy...');
    while (true) {
        try {
            const jobStr = await redis.lpop('onlook:job-queue');
            if (jobStr) {
                const job = JSON.parse(jobStr);
                await processJob(job);
            }
            else {
                console.log('⏳ Không có job trong hàng đợi...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        catch (err) {
            console.error('❌ Lỗi vòng lặp worker:', err);
        }
    }
};
// 🌐 Health check
const app = (0, express_1.default)();
app.get('/', (req, res) => {
    res.send('🟢 Worker hoạt động');
});
app.listen(Number(PORT), () => {
    console.log(`🌐 Listening on port ${PORT}`);
});
// 🚀 Khởi chạy worker
startWorker();
