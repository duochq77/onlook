"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
console.log('🚀 Worker process-video-worker.ts khởi động');
// 🔐 Biến môi trường
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
const redis = new redis_1.Redis({ url: redisUrl, token: redisToken });
const downloadFile = async (url, filePath) => {
    const res = await (0, node_fetch_1.default)(url);
    if (!res.ok)
        throw new Error(`Không thể tải file từ: ${url}`);
    const fileStream = fs_1.default.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
        res.body?.pipe(fileStream);
        res.body?.on('error', reject);
        fileStream.on('finish', () => resolve());
    });
};
const getDuration = async (filePath) => {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
            if (err)
                return reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
};
const loopMedia = async (input, output, duration) => {
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
const cutMedia = async (input, output, duration) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(input)
            .setDuration(duration)
            .save(output)
            .on('end', () => resolve())
            .on('error', reject);
    });
};
const processJob = async (job) => {
    console.log('📦 Job nhận được:', job);
    const tmpDir = path_1.default.join(os_1.default.tmpdir(), `onlook-job-${job.jobId}`);
    fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    fs_1.default.mkdirSync(tmpDir);
    const inputVideo = path_1.default.join(tmpDir, 'input.mp4');
    const inputAudio = path_1.default.join(tmpDir, 'input.mp3');
    const cleanVideo = path_1.default.join(tmpDir, 'clean.mp4');
    const finalVideo = path_1.default.join(tmpDir, 'final.mp4');
    const finalAudio = path_1.default.join(tmpDir, 'final.mp3');
    const mergedOutput = path_1.default.join(tmpDir, 'output.mp4');
    try {
        console.log('📥 Tải video...');
        await downloadFile(job.videoUrl, inputVideo);
        console.log('📥 Tải audio...');
        await downloadFile(job.audioUrl, inputAudio);
        console.log('✂️ Tách audio khỏi video...');
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
        console.log(`🎯 Độ dài: video = ${videoDur}, audio = ${audioDur}`);
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
        console.log('🔀 Ghép video và audio...');
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
        console.log('☁️ Upload lên Supabase:', outputPath);
        await supabase.storage.from(supabaseStorageBucket).upload(outputPath, buffer, {
            upsert: true,
            contentType: 'video/mp4',
        });
        console.log('🧹 Xóa file gốc trên Supabase...');
        await supabase.storage.from(supabaseStorageBucket).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`,
        ]);
    }
    catch (err) {
        console.error('❌ Lỗi xử lý job:', err);
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
        console.log('🧹 Dọn RAM xong');
    }
};
const startWorker = async () => {
    console.log('👷 Worker nền đang chạy...');
    while (true) {
        try {
            const jobStr = await redis.lpop('onlook:job-queue');
            if (typeof jobStr === 'string') {
                const job = JSON.parse(jobStr);
                await processJob(job);
            }
            else {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        catch (err) {
            console.error('❌ Lỗi vòng lặp chính:', err);
        }
    }
};
startWorker();
// Server để check health trên Cloud Run
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
app.get('/', function (_req, res) {
    res.send('🟢 Worker đang hoạt động');
});
app.listen(PORT, () => {
    console.log(`🌐 Listening on port ${PORT}`);
});
