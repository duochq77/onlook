"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_s3_1 = require("@aws-sdk/client-s3");
const livekit_server_sdk_1 = require("livekit-server-sdk");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.DELETE_PORT || '4002');
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// S3 Client
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
// LiveKit
const client = new livekit_server_sdk_1.IngressClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
app.post('/stop', async (req, res) => {
    const { ingressId, key } = req.body;
    if (!ingressId || !key)
        return res.status(400).json({ error: 'Missing ingressId or key' });
    try {
        await client.deleteIngress(ingressId);
        await s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        }));
        res.json({ success: true });
    }
    catch (err) {
        console.error('❌ Error stopping:', err);
        res.status(500).json({ success: false, error: 'Stop failed' });
    }
});
app.listen(PORT, () => {
    console.log(`🧹 Delete service running at http://localhost:${PORT}`);
});
