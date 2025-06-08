"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const node_fetch_1 = __importDefault(require("node-fetch"));
const path_1 = __importDefault(require("path"));
const OUTPUT_NAME = process.env.OUTPUT_NAME;
const INPUT_VIDEO_URL = process.env.INPUT_VIDEO_URL;
const INPUT_AUDIO_URL = process.env.INPUT_AUDIO_URL;
const TMP = '/tmp';
const inputVideo = path_1.default.join(TMP, 'input.mp4');
const inputAudio = path_1.default.join(TMP, 'input.mp3');
const cleanVideo = path_1.default.join(TMP, 'clean.mp4');
const output = path_1.default.join(TMP, OUTPUT_NAME);
async function download(url, dest) {
    const res = await (0, node_fetch_1.default)(url);
    if (!res.ok)
        throw new Error(`❌ Không tải được: ${url}`);
    if (!res.body)
        throw new Error(`❌ Phản hồi rỗng từ: ${url}`);
    const fileStream = fs_1.default.createWriteStream(dest);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
}
async function run() {
    console.log('📥 Đang tải file video và audio...');
    await download(INPUT_VIDEO_URL, inputVideo);
    await download(INPUT_AUDIO_URL, inputAudio);
    if (!fs_1.default.existsSync(inputVideo) || !fs_1.default.existsSync(inputAudio)) {
        console.error('❌ File tải về không tồn tại!');
        process.exit(1);
    }
    console.log('✂️ Tách audio khỏi video...');
    try {
        (0, child_process_1.execSync)(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`);
    }
    catch (err) {
        console.error('❌ Lỗi khi tách audio:', err);
        process.exit(1);
    }
    console.log('🎧 Ghép audio mới vào video...');
    try {
        (0, child_process_1.execSync)(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${output} -y`);
    }
    catch (err) {
        console.error('❌ Lỗi khi ghép audio:', err);
        process.exit(1);
    }
    console.log(`✅ Xong! File tạo ra: ${output}`);
}
run();
