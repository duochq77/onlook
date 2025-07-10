"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_s3_1 = require("@aws-sdk/client-s3");
const formidable_1 = __importDefault(require("formidable"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const R2 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
app.post('/upload', async (req, res) => {
    const form = new formidable_1.default.IncomingForm({ uploadDir: '/tmp', keepExtensions: true });
    form.parse(req, async (err, fields, files) => {
        if (err)
            return res.status(500).json({ error: 'Upload error', detail: err });
        const file = files.file;
        const jobId = fields.jobId?.[0];
        if (!file || !jobId)
            return res.status(400).json({ error: 'Thiếu file hoặc jobId' });
        const filePath = file.filepath || (Array.isArray(file) && file[0]?.filepath);
        if (!filePath)
            return res.status(400).json({ error: 'Không tìm thấy đường dẫn file' });
        const fileStream = fs_1.default.createReadStream(filePath);
        const fileKey = `audio/${jobId}.mp3`;
        try {
            await R2.send(new client_s3_1.PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileKey,
                Body: fileStream,
                ContentType: 'audio/mpeg',
                ACL: 'public-read',
            }));
            const publicUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`;
            return res.status(200).json({ success: true, url: publicUrl, key: fileKey });
        }
        catch (e) {
            return res.status(500).json({ error: 'R2 upload failed', detail: e.message });
        }
    });
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Upload Audio Worker running on port ${PORT}`);
});
