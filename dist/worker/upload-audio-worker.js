"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const formidable_1 = require("formidable");
const client_s3_1 = require("@aws-sdk/client-s3");
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
app.use((0, cors_1.default)());
app.options('*', (0, cors_1.default)());
// 🔍 In log biến môi trường để kiểm tra
console.log('🌍 ENV R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
console.log('🌍 ENV R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID);
console.log('🌍 ENV R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Có' : '❌ Không có');
console.log('🌍 ENV R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Có' : '❌ Không có');
// ✅ Cấu hình Cloudflare R2
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});
app.post('/upload', (req, res) => {
    const form = new formidable_1.IncomingForm({ multiples: false, keepExtensions: true });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('❌ Lỗi parse form:', err);
            return res.status(500).json({ error: 'Lỗi xử lý form dữ liệu.' });
        }
        try {
            const rawFile = files.file;
            if (!rawFile) {
                return res.status(400).json({ error: 'Không tìm thấy file trong form data.' });
            }
            const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;
            console.log('📤 Bắt đầu upload file MP3:', file.originalFilename);
            const fileStream = fs_1.default.createReadStream(file.filepath);
            const fileName = `${Date.now()}-${file.originalFilename}`;
            const uploadParams = {
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileName,
                Body: fileStream,
                ContentType: file.mimetype || 'audio/mpeg'
            };
            await s3.send(new client_s3_1.PutObjectCommand(uploadParams));
            const fileUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileName}`;
            console.log('✅ Upload thành công:', fileName);
            res.status(200).json({
                success: true,
                message: 'Upload thành công',
                url: fileUrl,
                key: fileName
            });
        }
        catch (error) {
            console.error('❌ Upload thất bại:', error);
            res.status(500).json({ success: false, error: 'Upload thất bại', detail: String(error) });
        }
    });
});
app.listen(port, () => {
    console.log(`🚀 Upload Audio Worker running on port ${port}`);
});
