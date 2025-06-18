"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffprobe_static_1 = __importDefault(require("ffprobe-static"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const stream_1 = __importDefault(require("stream"));
const util_1 = require("util");
const express_1 = __importDefault(require("express"));
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
fluent_ffmpeg_1.default.setFfprobePath(ffprobe_static_1.default.path);
const pipeline = (0, util_1.promisify)(stream_1.default.pipeline);
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const getDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
            if (err)
                return reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
};
const downloadFile = async (url, dest) => {
    const res = await fetch(url);
    if (!res.ok || !res.body)
        throw new Error('Download failed: ' + url);
    const fileStream = fs_1.default.createWriteStream(dest);
    await pipeline(res.body, fileStream);
};
const loopMedia = (input, output, minDuration) => {
    return new Promise(async (resolve, reject) => {
        const inputDuration = await getDuration(input);
        const loopCount = Math.ceil(minDuration / inputDuration);
        const inputs = Array(loopCount).fill(`-i ${input}`).join(' ');
        const filter = Array(loopCount).fill('[0:v:0]').join('') + `concat=n=${loopCount}:v=1:a=0[outv]`;
        const cmd = `ffmpeg ${inputs} -filter_complex "${filter}" -map "[outv]" -y ${output}`;
        (0, child_process_1.exec)(cmd, (err) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
};
const cutMedia = (input, output, duration) => {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(input)
            .outputOptions(['-t', duration.toFixed(2)])
            .save(output)
            .on('end', () => resolve())
            .on('error', reject);
    });
};
const main = async () => {
    console.log('📡 Đang chờ job từ Redis...');
    while (true) {
        const raw = await redis.lpop('video-process-jobs');
        if (!raw) {
            await new Promise(r => setTimeout(r, 3000));
            continue;
        }
        const job = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
        console.log('🛠 Nhận job:', job);
        const tmpDir = path_1.default.join(os_1.default.tmpdir(), `onlook-job-${job.jobId}`);
        fs_1.default.rmSync(tmpDir, { force: true, recursive: true });
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
            await supabase.storage
                .from(supabaseStorageBucket)
                .upload(`outputs/${job.outputName}`, buffer, {
                upsert: true,
                contentType: 'video/mp4',
            });
            await supabase.storage.from(supabaseStorageBucket).remove([
                `input-videos/input-${job.jobId}.mp4`,
                `input-audios/input-${job.jobId}.mp3`,
            ]);
        }
        catch (err) {
            console.error('❌ Worker lỗi:', err);
        }
        finally {
            fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
        }
    }
};
// Dummy HTTP server để vượt Cloud Run health check
const app = (0, express_1.default)();
app.get('/', (req, res) => {
    res.send('OK');
});
app.listen(process.env.PORT || 8080, () => {
    console.log(`🚀 Worker chạy tại cổng ${process.env.PORT || 8080}`);
    main();
});
