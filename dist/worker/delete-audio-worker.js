"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_s3_1 = require("@aws-sdk/client-s3");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const R2 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
app.post('/delete', async (req, res) => {
    const { key } = req.body;
    if (!key)
        return res.status(400).json({ error: 'Thiếu key file' });
    try {
        await R2.send(new client_s3_1.DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        }));
        return res.status(200).json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: 'Delete failed', detail: e.message });
    }
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🧼 Delete Audio Worker running on port ${PORT}`);
});
