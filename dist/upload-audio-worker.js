import express from 'express';
import cors from 'cors';
import { IncomingForm } from 'formidable';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
const app = express();
const port = process.env.PORT || 8080;
app.use(cors());
app.options('*', cors());
// 🔍 In log biến môi trường để kiểm tra
console.log('🌍 ENV R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
console.log('🌍 ENV R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID);
console.log('🌍 ENV R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Có' : '❌ Không có');
console.log('🌍 ENV R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Có' : '❌ Không có');
// ✅ Cấu hình Cloudflare R2
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});
app.post('/upload', (req, res) => {
    const form = new IncomingForm({ multiples: false, keepExtensions: true });
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
            const fileStream = fs.createReadStream(file.filepath);
            const fileName = `${Date.now()}-${file.originalFilename}`;
            const uploadParams = {
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileName,
                Body: fileStream,
                ContentType: file.mimetype || 'audio/mpeg'
            };
            await s3.send(new PutObjectCommand(uploadParams));
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
