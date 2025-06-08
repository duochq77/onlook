"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// worker/process-video-worker.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const TEMP = '/tmp';
function waitForFile(filePath, retries = 30) {
    for (let i = 0; i < retries; i++) {
        if (fs_1.default.existsSync(filePath))
            return true;
        console.log(`⏳ Chờ file ${filePath}...`);
        (0, child_process_1.execSync)('sleep 1');
    }
    return false;
}
async function run() {
    const outputName = process.env.OUTPUT_NAME;
    if (!outputName) {
        console.error('❌ Thiếu OUTPUT_NAME trong ENV!');
        return;
    }
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const jobDir = path_1.default.join(TEMP, jobId);
    fs_1.default.mkdirSync(jobDir);
    // Đường dẫn tạm trong thư mục riêng
    const inputVideo = path_1.default.join(jobDir, `input-${outputName}.mp4`);
    const inputAudio = path_1.default.join(jobDir, `input-${outputName}.mp3`);
    const cleanVideo = path_1.default.join(jobDir, `clean-${outputName}`);
    const output = path_1.default.join(TEMP, outputName); // Xuất ra TEMP gốc để client tải
    // Copy từ gốc về thư mục riêng để xử lý an toàn
    fs_1.default.copyFileSync(path_1.default.join(TEMP, `input-${outputName}.mp4`), inputVideo);
    fs_1.default.copyFileSync(path_1.default.join(TEMP, `input-${outputName}.mp3`), inputAudio);
    if (!waitForFile(inputVideo) || !waitForFile(inputAudio)) {
        console.error('❌ Không tìm thấy file video hoặc audio!');
        return;
    }
    console.log('✂️ Đang tách audio khỏi video...');
    (0, child_process_1.execSync)(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`);
    console.log('🎧 Đang ghép audio gốc vào video sạch...');
    (0, child_process_1.execSync)(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${output} -y`);
    console.log('✅ Hoàn tất xử lý file:', output);
}
run();
