"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
// ✅ Cho phép mọi domain gọi API (có thể thay thế origin cụ thể)
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// 🔍 Log các biến môi trường để kiểm tra
console.log('🌍 ENV R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
console.log('🌍 ENV R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID);
console.log('🌍 ENV R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Có' : '❌ Không có');
console.log('🌍 ENV R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Có' : '❌ Không có');
// ✅ Cấu hình kết nối tới Cloudflare R2
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
// 👇 Xử lý CORS cho preflight request
app.options('/delete', (0, cors_1.default)({ origin: true }));
// ✅ API xoá file .mp3 từ R2
app.post('/delete', async (req, res) => {
    const { key } = req.body;
    if (!key)
        return res.status(400).json({ error: 'Thiếu key để xoá' });
    try {
        console.log(`🧼 Đang xoá file MP3: ${key}`);
        await s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        }));
        console.log(`✅ Đã xoá file: ${key}`);
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error('❌ Lỗi khi xoá file:', err);
        res.status(500).json({ success: false, error: 'Xoá thất bại' });
    }
});
// ✅ Khởi động server
app.listen(port, () => {
    console.log(`🚀 Delete Audio Worker running on port ${port}`);
});
