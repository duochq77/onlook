import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { IncomingForm, Fields, Files } from 'formidable';
import fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { execa } from 'execa';
import {
    IngressClient,
    IngressInput,
    IngressVideoOptions,
    IngressAudioOptions,
    TrackSource,
    IngressVideoEncodingPreset,
    IngressAudioEncodingPreset,
} from 'livekit-server-sdk';

const app = express();
const PORT = parseInt(process.env.INGRESS_PORT || '4001');
app.use(cors());
app.use(express.json());

// Cloudflare R2 S3 Client
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

// Upload endpoint
app.post('/upload', (req: Request, res: Response) => {
    const form = new IncomingForm({ keepExtensions: true });

    form.parse(req, async (err: any, fields: Fields, files: Files) => {
        if (err) return res.status(500).json({ error: 'Form parse error' });

        const rawFile = files.file;
        if (!rawFile) return res.status(400).json({ error: 'Missing file' });
        const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;
        const key = `${Date.now()}-${file.originalFilename}`;
        const fileStream = fs.createReadStream(file.filepath);

        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
                Body: fileStream,
                ContentType: file.mimetype || 'video/mp4',
            })
        );

        res.status(200).json({ key });
    });
});

// Livestream endpoint
app.post('/ingress', async (req: Request, res: Response) => {
    const { roomName, key } = req.body;
    if (!roomName || !key) return res.status(400).send('Missing roomName or key');

    const videoUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;

    const client = new IngressClient(
        process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
    );

    const ingress = await client.createIngress(IngressInput.URL_INPUT, {
        roomName,
        participantIdentity: `ingress-${roomName}`,
        participantName: `Ingress ${roomName}`,
        url: videoUrl,
        enableTranscoding: true,
        video: new IngressVideoOptions({
            source: TrackSource.CAMERA,
            encodingOptions: {
                case: 'preset',
                value: IngressVideoEncodingPreset.H264_720P_30FPS_3_LAYERS,
            },
        }),
        audio: new IngressAudioOptions({
            source: TrackSource.MICROPHONE,
            encodingOptions: {
                case: 'preset',
                value: IngressAudioEncodingPreset.OPUS_STEREO_96KBPS,
            },
        }),
    });

    const publishUrl = `${ingress.url}/${ingress.streamKey}`;
    console.log('▶️ Ingress started →', publishUrl);

    const ff = execa('ffmpeg', [
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

    ff.stdout?.on('data', (d: Buffer) => console.log('[ffmpeg]', d.toString()));
    ff.stderr?.on('data', (d: Buffer) => console.error('[ffmpeg error]', d.toString()));

    res.json({ ingressId: ingress.ingressId });
});

app.listen(PORT, () => {
    console.log(`🚀 Ingress service running at http://localhost:${PORT}`);
});
