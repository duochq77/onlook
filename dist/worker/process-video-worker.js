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
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, PORT = '8080' } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET || !REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.');
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new ioredis_1.default({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {}
});
redis.on('error', err => console.error('❌ Redis error:', err));
const downloadFile = async (url) => {
    if (!url || !url.startsWith('http'))
        throw new Error(`❌ URL không hợp lệ: ${url}`);
    const res = await (0, node_fetch_1.default)(url);
    if (!res.ok)
        throw new Error(`Không tải được file từ: ${url}`);
    return Buffer.from(await res.arrayBuffer());
};
const saveBufferToFile = async (buffer, filePath) => {
    await fs_1.default.promises.writeFile(filePath, buffer);
};
const getDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
            if (err)
                reject(err);
            else
                resolve(metadata.format.duration ?? 0);
        });
    });
};
const loopMedia = (input, output, duration) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(input)
            .inputOptions('-stream_loop', '-1')
            .outputOptions('-t', `${duration}`)
            .output(output)
            .on('end', () => resolve())
            .on('error', reject)
            .run();
    });
};
const cutMedia = (input, output, duration) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(input)
            .setDuration(duration)
            .output(output)
            .on('end', () => resolve())
            .on('error', reject)
            .run();
    });
};
const mergeMedia = (video, audio, output) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(video)
            .input(audio)
            .outputOptions('-c:v copy', '-c:a aac', '-shortest')
            .output(output)
            .on('end', () => resolve())
            .on('error', reject)
            .run();
    });
};
const processJob = async (job) => {
    console.log('📦 Đã nhận job:', job.jobId);
    if (!job?.videoUrl?.startsWith('http') || !job?.audioUrl?.startsWith('http')) {
        console.error('❌ Job thiếu URL tuyệt đối:', job);
        return;
    }
    const tmp = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), `job-${job.jobId}-`));
    const inputVideo = path_1.default.join(tmp, 'video.mp4');
    const inputAudio = path_1.default.join(tmp, 'audio.mp3');
    const cleanVideo = path_1.default.join(tmp, 'clean.mp4');
    const finalVideo = path_1.default.join(tmp, 'final.mp4');
    const finalAudio = path_1.default.join(tmp, 'final.mp3');
    const outputFile = path_1.default.join(tmp, 'merged.mp4');
    try {
        console.log('⬇️ Tải video...');
        const videoBuffer = await downloadFile(job.videoUrl);
        console.log('⬇️ Tải audio...');
        const audioBuffer = await downloadFile(job.audioUrl);
        await saveBufferToFile(videoBuffer, inputVideo);
        await saveBufferToFile(audioBuffer, inputAudio);
        console.log('✂️ Tách video sạch...');
        await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input(inputVideo)
                .noAudio()
                .output(cleanVideo)
                .on('end', () => resolve())
                .on('error', reject)
                .run();
        });
        const videoDur = await getDuration(cleanVideo);
        const audioDur = await getDuration(inputAudio);
        console.log(`📏 Duration video: ${videoDur}s, audio: ${audioDur}s`);
        if (Math.abs(videoDur - audioDur) < 1) {
            fs_1.default.copyFileSync(cleanVideo, finalVideo);
            fs_1.default.copyFileSync(inputAudio, finalAudio);
        }
        else if (videoDur < audioDur) {
            await loopMedia(cleanVideo, finalVideo, audioDur);
            await cutMedia(finalVideo, finalVideo, audioDur);
            fs_1.default.copyFileSync(inputAudio, finalAudio);
        }
        else {
            await cutMedia(cleanVideo, finalVideo, audioDur);
            fs_1.default.copyFileSync(inputAudio, finalAudio);
        }
        console.log('🎬 Ghép video + audio...');
        await mergeMedia(finalVideo, finalAudio, outputFile);
        const outputPath = `outputs/${job.outputName}`;
        const result = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(outputPath, fs_1.default.readFileSync(outputFile), {
            contentType: 'video/mp4',
            upsert: true
        });
        if (result.error)
            throw result.error;
        console.log(`✅ Đã upload kết quả lên Supabase: ${outputPath}`);
        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`
        ]);
        console.log('🧹 Đã xoá 2 file nguyên liệu');
    }
    catch (err) {
        console.error(`❌ Lỗi khi xử lý job ${job.jobId}:`, err);
    }
    finally {
        fs_1.default.rmSync(tmp, { recursive: true, force: true });
    }
};
// ✅ Worker nền đã bị tắt tạm thời để kiểm tra Redis
// ❌ Không khởi động vòng lặp worker nữa
// const startWorker = async () => { ... }
// startWorker()
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/', (_req, res) => {
    res.send('🟢 process-video-worker hoạt động');
});
app.post('/', (_req, res) => {
    res.status(200).send('OK');
});
app.listen(Number(PORT), () => {
    console.log(`🌐 Server lắng nghe tại PORT ${PORT}`);
});
// ⛔ Worker đang được tạm tắt để kiểm tra Redis
// startWorker()
