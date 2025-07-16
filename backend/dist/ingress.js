"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const formidable_1 = require("formidable");
const fs_1 = __importDefault(require("fs"));
const client_s3_1 = require("@aws-sdk/client-s3");
const execa_1 = require("execa");
const livekit_server_sdk_1 = require("livekit-server-sdk");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.INGRESS_PORT || '4001');
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Cloudflare R2 S3 Client
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
// Upload endpoint
app.post('/upload', (req, res) => {
    const form = new formidable_1.IncomingForm({ keepExtensions: true });
    form.parse(req, async (err, fields, files) => {
        if (err)
            return res.status(500).json({ error: 'Form parse error' });
        const rawFile = files.file;
        if (!rawFile)
            return res.status(400).json({ error: 'Missing file' });
        const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;
        const key = `${Date.now()}-${file.originalFilename}`;
        const fileStream = fs_1.default.createReadStream(file.filepath);
        await s3.send(new client_s3_1.PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: fileStream,
            ContentType: file.mimetype || 'video/mp4',
        }));
        res.status(200).json({ key });
    });
});
// Livestream endpoint
app.post('/ingress', async (req, res) => {
    const { roomName, key } = req.body;
    if (!roomName || !key)
        return res.status(400).send('Missing roomName or key');
    const videoUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;
    const client = new livekit_server_sdk_1.IngressClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    const ingress = await client.createIngress(livekit_server_sdk_1.IngressInput.URL_INPUT, {
        roomName,
        participantIdentity: `ingress-${roomName}`,
        participantName: `Ingress ${roomName}`,
        url: videoUrl,
        enableTranscoding: true,
        video: new livekit_server_sdk_1.IngressVideoOptions({
            source: livekit_server_sdk_1.TrackSource.CAMERA,
            encodingOptions: {
                case: 'preset',
                value: livekit_server_sdk_1.IngressVideoEncodingPreset.H264_720P_30FPS_3_LAYERS,
            },
        }),
        audio: new livekit_server_sdk_1.IngressAudioOptions({
            source: livekit_server_sdk_1.TrackSource.MICROPHONE,
            encodingOptions: {
                case: 'preset',
                value: livekit_server_sdk_1.IngressAudioEncodingPreset.OPUS_STEREO_96KBPS,
            },
        }),
    });
    const publishUrl = `${ingress.url}/${ingress.streamKey}`;
    console.log('▶️ Ingress started →', publishUrl);
    const ff = (0, execa_1.execa)('ffmpeg', [
        '-re',
        '-i',
        videoUrl,
        '-c:v',
        'libx264',
        '-b:v',
        '3M',
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-f',
        'flv',
        publishUrl,
    ]);
    ff.stdout?.on('data', (d) => console.log('[ffmpeg]', d.toString()));
    ff.stderr?.on('data', (d) => console.error('[ffmpeg error]', d.toString()));
    res.json({ ingressId: ingress.ingressId });
});
app.listen(PORT, () => {
    console.log(`🚀 Ingress service running at http://localhost:${PORT}`);
});
