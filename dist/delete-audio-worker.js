import express from 'express';
import cors from 'cors';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const app = express();
const port = process.env.PORT || 8080;
// ✅ Cho phép mọi domain gọi API (có thể thay thế origin cụ thể)
app.use(cors({ origin: true }));
app.use(express.json());
// 🔍 Log các biến môi trường để kiểm tra
console.log('🌍 ENV R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
console.log('🌍 ENV R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID);
console.log('🌍 ENV R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Có' : '❌ Không có');
console.log('🌍 ENV R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Có' : '❌ Không có');
// ✅ Cấu hình kết nối tới Cloudflare R2
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
// 👇 Xử lý CORS cho preflight request
app.options('/delete', cors({ origin: true }));
// ✅ API xoá file .mp3 từ R2
app.post('/delete', async (req, res) => {
    const { key } = req.body;
    if (!key)
        return res.status(400).json({ error: 'Thiếu key để xoá' });
    try {
        console.log(`🧼 Đang xoá file MP3: ${key}`);
        await s3.send(new DeleteObjectCommand({
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
