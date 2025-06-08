"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// worker/process-video-worker.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const child_process_1 = require("child_process");
const TEMP = '/tmp';
function log(msg) {
    console.log(`[PROCESS] ${msg}`);
}
async function download(url, dest) {
    const res = await (0, node_fetch_1.default)(url);
    if (!res.ok)
        throw new Error(`❌ Không tải được: ${url}`);
    if (!res.body)
        throw new Error(`❌ Phản hồi từ ${url} không có dữ liệu!`);
    const fileStream = fs_1.default.createWriteStream(dest);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', (err) => {
            console.error('❌ Lỗi khi tải file:', err);
            reject(err);
        });
        fileStream.on('finish', resolve);
    });
}
async function run() {
    const outputName = process.env.OUTPUT_NAME;
    const videoURL = process.env.INPUT_VIDEO_URL;
    const audioURL = process.env.INPUT_AUDIO_URL;
    if (!outputName || !videoURL || !audioURL) {
        console.error('❌ Thiếu ENV: OUTPUT_NAME / INPUT_VIDEO_URL / INPUT_AUDIO_URL');
        process.exit(1);
    }
    const jobDir = path_1.default.join(TEMP, `job-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs_1.default.mkdirSync(jobDir);
    const inputVideo = path_1.default.join(jobDir, 'input.mp4');
    const inputAudio = path_1.default.join(jobDir, 'input.mp3');
    const cleanVideo = path_1.default.join(jobDir, 'clean.mp4');
    const output = path_1.default.join(TEMP, outputName);
    log('🔽 Đang tải video gốc...');
    await download(videoURL, inputVideo);
    log('🔽 Đang tải audio gốc...');
    await download(audioURL, inputAudio);
    // ✅ Kiểm tra sự tồn tại của file
    if (!fs_1.default.existsSync(inputVideo) || !fs_1.default.existsSync(inputAudio)) {
        console.error('❌ File tải xuống bị lỗi hoặc không tồn tại!');
        process.exit(1);
    }
    log('✂️ Tách audio khỏi video...');
    try {
        (0, child_process_1.execSync)(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`);
    }
    catch (err) {
        console.error('❌ Lỗi khi tách audio:', err);
        process.exit(1);
    }
    log('🎧 Ghép audio mới vào video sạch...');
    try {
        (0, child_process_1.execSync)(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${output} -y`);
    }
    catch (err) {
        console.error('❌ Lỗi khi ghép audio:', err);
        process.exit(1);
    }
    log(`✅ Xử lý xong! Kết quả: ${output}`);
}
run().catch(err => {
    console.error('❌ Lỗi xử lý:', err);
    process.exit(1);
});
