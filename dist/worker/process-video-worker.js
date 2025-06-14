"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const supabase_js_1 = require("@supabase/supabase-js");
const redis_1 = require("@upstash/redis");
const stream_1 = require("stream");
// Khởi tạo Redis client
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
// Lấy biến môi trường Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
// Debug thông tin biến môi trường
console.log('DEBUG: Supabase URL:', supabaseUrl);
console.log('DEBUG: Supabase Anon Key:', supabaseAnonKey ? 'Exists' : 'Missing');
console.log('DEBUG: Supabase Service Role Key:', supabaseServiceRole ? 'Exists' : 'Missing');
console.log('DEBUG: Supabase Storage Bucket:', supabaseStorageBucket ? supabaseStorageBucket : 'Missing');
// Kiểm tra đủ biến môi trường cần thiết
if (!supabaseUrl || !supabaseAnonKey || !supabaseStorageBucket) {
    throw new Error('Missing required Supabase environment variables!');
}
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing required Upstash Redis environment variables!');
}
// Tạo Supabase client (đang dùng anon key)
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
// Nếu có service role key thì tạo thêm client quyền cao hơn
const supabaseAdmin = supabaseServiceRole
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRole)
    : null;
const TMP = '/tmp';
const QUEUE_KEY = 'onlook:job-queue';
// Hàm tải file từ url về local
async function download(url, dest) {
    const res = await fetch(url);
    if (!res.ok || !res.body)
        throw new Error(`❌ Không tải được file: ${url}`);
    const fileStream = fs_1.default.createWriteStream(dest);
    const nodeStream = stream_1.Readable.from(res.body);
    await new Promise((resolve, reject) => {
        nodeStream.pipe(fileStream);
        nodeStream.on('error', reject);
        fileStream.on('finish', resolve);
    });
}
// Kiểm tra file tồn tại và có dung lượng > 0
const checkFileSize = (filePath) => {
    try {
        const stats = fs_1.default.statSync(filePath);
        return stats.size > 0;
    }
    catch {
        return false;
    }
};
// Hàm trích xuất path file gốc trong Supabase từ url lưu trữ
const extractPath = (url) => {
    try {
        const parts = url.split(`/storage/v1/object/public/${supabaseStorageBucket}/`);
        if (parts.length === 2)
            return parts[1];
        return '';
    }
    catch {
        return '';
    }
};
// Xử lý 1 job media
async function processJob(job) {
    console.log('📌 Xử lý job:', job.jobId);
    const basePath = path_1.default.join(TMP, job.jobId);
    if (!fs_1.default.existsSync(basePath))
        fs_1.default.mkdirSync(basePath, { recursive: true });
    const inputVideo = path_1.default.join(basePath, 'input.mp4');
    const inputAudio = path_1.default.join(basePath, 'input.mp3');
    const cleanVideo = path_1.default.join(basePath, 'clean.mp4');
    const outputFile = path_1.default.join(basePath, job.outputName);
    try {
        // Tải video và audio về
        console.log('📥 Tải video + audio từ Supabase...');
        await download(job.videoUrl, inputVideo);
        await download(job.audioUrl, inputAudio);
        // Kiểm tra file tải về
        if (!fs_1.default.existsSync(inputVideo) || !fs_1.default.existsSync(inputAudio))
            throw new Error('File tải về không tồn tại');
        if (!checkFileSize(inputVideo) || !checkFileSize(inputAudio))
            throw new Error('File tải về dung lượng 0');
        // Tách audio khỏi video gốc
        console.log('✂️ Tách audio khỏi video...');
        (0, child_process_1.execSync)(`ffmpeg -i ${inputVideo} -an -c:v copy ${cleanVideo} -y`);
        // Ghép audio mới vào video sạch
        console.log('🎧 Ghép audio gốc vào video sạch...');
        (0, child_process_1.execSync)(`ffmpeg -i ${cleanVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputFile} -y`);
        // Upload file kết quả lên Supabase
        console.log('📤 Upload file kết quả lên Supabase...');
        const { error } = await supabase.storage
            .from(supabaseStorageBucket)
            .upload(`${job.jobId}/outputs/${job.outputName}`, fs_1.default.createReadStream(outputFile), {
            contentType: 'video/mp4',
            upsert: true,
        });
        if (error)
            throw new Error('Lỗi upload file hoàn chỉnh: ' + error.message);
        console.log('✅ Upload thành công');
        // Xoá file temp local
        for (const f of [inputVideo, inputAudio, cleanVideo, outputFile]) {
            try {
                if (fs_1.default.existsSync(f))
                    fs_1.default.unlinkSync(f);
            }
            catch {
                // Không làm gì nếu lỗi
            }
        }
        // Xoá file gốc trong Supabase
        const videoPath = extractPath(job.videoUrl);
        const audioPath = extractPath(job.audioUrl);
        if (videoPath) {
            try {
                await supabase.storage.from(supabaseStorageBucket).remove([videoPath]);
            }
            catch {
                // Không làm gì nếu lỗi
            }
        }
        if (audioPath) {
            try {
                await supabase.storage.from(supabaseStorageBucket).remove([audioPath]);
            }
            catch {
                // Không làm gì nếu lỗi
            }
        }
        console.log(`✅ Hoàn thành job ${job.jobId}`);
    }
    catch (err) {
        console.error(`❌ Lỗi xử lý job ${job.jobId}:`, err);
    }
}
// Hàm delay đơn giản
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Hàm chạy worker lấy job từ Redis queue và xử lý liên tục
async function runWorker() {
    console.log('⏳ Worker Onlook đang chạy, chờ job...');
    while (true) {
        try {
            const jobStr = await redis.rpop(QUEUE_KEY);
            if (!jobStr) {
                await sleep(1000);
                continue;
            }
            const job = JSON.parse(jobStr);
            await processJob(job);
        }
        catch (error) {
            console.error('❌ Lỗi worker khi lấy hoặc xử lý job:', error);
            await sleep(1000);
        }
    }
}
// Khởi tạo HTTP server đơn giản để giữ app chạy
const port = process.env.PORT || 8080;
const server = http_1.default.createServer((req, res) => {
    res.writeHead(200);
    res.end('Worker is alive');
});
server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
    runWorker();
});
