"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const formidable_1 = require("formidable");
const fs_1 = require("fs");
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv_1 = __importDefault(require("dotenv"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
app.get('/', (_, res) => {
    res.send('✅ Ingress worker is running');
});
app.post('/upload', async (req, res) => {
    const form = new formidable_1.IncomingForm({ uploadDir: '/tmp', keepExtensions: true });
    form.parse(req, async (err, fields, files) => {
        if (err || !files.file) {
            return res.status(500).json({ error: 'Lỗi khi xử lý upload' });
        }
        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        const filePath = file.filepath;
        const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.mp4`;
        const r2 = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });
        const uploadCmd = new client_s3_1.PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: (0, fs_1.createReadStream)(filePath),
            ContentType: 'video/mp4',
        });
        try {
            await r2.send(uploadCmd);
            console.log(`✅ Đã upload video lên R2: ${fileName}`);
            const room = fileName.replace('.mp4', ''); // tên phòng giống tên file
            const svc = new livekit_server_sdk_1.RoomServiceClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
            await svc.createRoom({ name: room });
            console.log(`🎬 Đã tạo phòng livestream: ${room}`);
            return res.status(200).json({ message: 'Thành công', roomName: room, fileKey: fileName });
        }
        catch (e) {
            console.error('❌ Upload hoặc tạo phòng thất bại:', e);
            return res.status(500).json({ error: 'Upload hoặc tạo phòng thất bại' });
        }
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Ingress worker listening on port ${PORT}`);
});
