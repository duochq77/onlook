"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const ioredis_1 = __importDefault(require("ioredis"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
// 🛠 Biến môi trường
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, PORT = '8080', } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET || !REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
    throw new Error('❌ Thiếu biến môi trường bắt buộc.');
}
// 🔌 Kết nối Supabase + Redis (TCP)
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new ioredis_1.default({
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: {},
    retryStrategy: (times) => Math.min(times * 200, 2000),
});
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const downloadFile = async (url, filePath) => {
    const writer = fs_1.default.createWriteStream(filePath);
    console.log(`📥 Bắt đầu tải file từ: ${url}`);
    const response = await axios_1.default.get(url, { responseType: 'stream', timeout: 300000 });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
    const stats = await fs_1.default.promises.stat(filePath);
    console.log(`✅ Tải xong file (${stats.size} bytes): ${url}`);
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
const mergeMedia = (video, audio, output, loopTarget, loopCount, targetDuration) => {
    return new Promise((resolve, reject) => {
        const args = [];
        if (loopTarget === 'audio') {
            args.push('-stream_loop', `${loopCount}`, '-i', audio, '-i', video);
        }
        else if (loopTarget === 'video') {
            args.push('-stream_loop', `${loopCount}`, '-i', video, '-i', audio);
        }
        else {
            args.push('-i', video, '-i', audio);
        }
        args.push('-t', `${targetDuration.toFixed(2)}`, '-c:v', 'copy', '-c:a', 'aac', '-preset', 'veryfast', '-b:a', '128k', '-shortest', '-vsync', 'vfr', '-movflags', '+faststart', '-y', output);
        console.log('🔗 FFmpeg merge CMD:', ['ffmpeg', ...args].join(' '));
        const proc = (0, child_process_1.spawn)('ffmpeg', args);
        const timeoutMs = targetDuration * 1.5 * 1000;
        const timeout = setTimeout(() => {
            console.error('⏱ FFmpeg timeout – sẽ kill tiến trình.');
            proc.kill('SIGKILL');
            reject(new Error('FFmpeg merge timeout'));
        }, timeoutMs);
        proc.stderr.on('data', (data) => console.error(`📄 FFmpeg stderr: ${data.toString()}`));
        proc.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        proc.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                console.log('✅ Merge thành công');
                resolve();
            }
            else {
                reject(new Error(`FFmpeg kết thúc với mã lỗi ${code}`));
            }
        });
    });
};
const processJob = async (job) => {
    console.log('📦 Nhận job:', job.jobId);
    if (!job?.videoUrl || !job?.audioUrl || !job?.sellerId)
        return console.error('❌ Thiếu dữ liệu job');
    const tmp = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), `job-${job.jobId}-`));
    console.log(`📂 Tạo thư mục tạm: ${tmp}`);
    const inputVideo = path_1.default.join(tmp, 'video.mp4');
    const inputAudio = path_1.default.join(tmp, 'audio.mp3');
    const cleanVideo = path_1.default.join(tmp, 'clean.mp4');
    const outputFile = path_1.default.join(tmp, 'merged.mp4');
    try {
        await downloadFile(job.videoUrl, inputVideo);
        await downloadFile(job.audioUrl, inputAudio);
        // Tách audio khỏi video gốc
        await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input(inputVideo)
                .outputOptions(['-an', '-c:v', 'copy', '-y'])
                .output(cleanVideo)
                .on('start', (cmd) => console.log('🔇 Tách audio khỏi video:', cmd))
                .on('progress', (p) => console.log(`📶 Tách audio: ${p.percent?.toFixed(2)}%`))
                .on('end', () => resolve())
                .on('error', reject)
                .run();
        });
        await delay(500);
        const videoDur = await getDuration(cleanVideo);
        const audioDur = await getDuration(inputAudio);
        const targetDuration = Math.max(videoDur, audioDur);
        let loopTarget = 'none';
        let loopCount = 0;
        if (Math.abs(videoDur - audioDur) >= 1) {
            loopTarget = videoDur > audioDur ? 'audio' : 'video';
            loopCount = Math.ceil(targetDuration / (loopTarget === 'audio' ? audioDur : videoDur));
        }
        await mergeMedia(cleanVideo, inputAudio, outputFile, loopTarget, loopCount, targetDuration);
        // Upload kết quả
        const uploadPath = `outputs/${job.outputName}`;
        console.log(`📤 Upload kết quả lên Supabase: ${uploadPath}`);
        const fileBuffer = await fs_1.default.promises.readFile(outputFile);
        const uploadResult = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(uploadPath, fileBuffer, {
            contentType: 'video/mp4',
            upsert: true,
        });
        if (uploadResult.error)
            throw uploadResult.error;
        console.log(`✅ Đã upload file merged lên Supabase: ${uploadPath}`);
        // Xoá file nguyên liệu theo sellerId
        const cleanup = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([
            `input-videos/${job.sellerId}/input-${job.jobId}.mp4`,
            `input-audios/${job.sellerId}/input-${job.jobId}.mp3`,
        ]);
        if (cleanup.error)
            console.warn('⚠️ Lỗi khi xoá file gốc:', cleanup.error);
        else
            console.log('🧼 Đã xoá 2 file nguyên liệu gốc.');
    }
    catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err);
    }
    finally {
        fs_1.default.rmSync(tmp, { recursive: true, force: true });
        console.log('🧹 Đã dọn thư mục RAM tạm:', tmp);
    }
};
const startWorker = async () => {
    console.log('🚀 Worker đã khởi động...');
    while (true) {
        try {
            const jobRaw = await redis.rpop('video-process-jobs');
            if (jobRaw) {
                const job = JSON.parse(jobRaw);
                await processJob(job);
            }
            else {
                await delay(2000);
            }
        }
        catch (err) {
            console.error('❌ Lỗi trong worker loop:', err);
        }
    }
};
startWorker();
// Server cho Cloud Run kiểm tra tình trạng
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/', (_req, res) => res.send('🟢 process-video-worker hoạt động'));
app.post('/', (_req, res) => res.status(200).send('OK'));
app.listen(Number(PORT), () => {
    console.log(`🌐 Server lắng nghe tại PORT ${PORT}`);
});
