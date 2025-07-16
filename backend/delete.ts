import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { IngressClient } from 'livekit-server-sdk';

const app = express();
const PORT = parseInt(process.env.DELETE_PORT || '4002');
app.use(cors());
app.use(express.json());

// S3 Client
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

// LiveKit
const client = new IngressClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
);

app.post('/stop', async (req: Request, res: Response) => {
    const { ingressId, key } = req.body;
    if (!ingressId || !key) return res.status(400).json({ error: 'Missing ingressId or key' });

    try {
        await client.deleteIngress(ingressId);
        await s3.send(
            new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
            })
        );
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error stopping:', err);
        res.status(500).json({ success: false, error: 'Stop failed' });
    }
});

app.listen(PORT, () => {
    console.log(`🧹 Delete service running at http://localhost:${PORT}`);
});
