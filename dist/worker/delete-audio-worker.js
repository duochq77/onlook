"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
app.use(express_1.default.json());
// ✅ Cấu hình kết nối Cloudflare R2
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
app.post('/delete', async (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ success: false, error: 'Thiếu key file để xoá.' });
    }
    try {
        console.log('🗑️ Đang xoá file MP3:', key);
        await s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        }));
        console.log('✅ Đã xoá thành công:', key);
        res.status(200).json({ success: true, message: 'Đã xoá thành công' });
    }
    catch (error) {
        console.error('❌ Lỗi xoá file:', error);
        res.status(500).json({ success: false, error: 'Xoá thất bại', detail: String(error) });
    }
});
app.listen(port, () => {
    console.log(`🚀 Delete Audio Worker running on port ${port}`);
});
