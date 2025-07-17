import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { execa } from 'execa';
import {
    IngressClient,
    CreateIngressOptions,
    IngressInput,
    TrackSource,
    IngressVideoOptions,
    IngressAudioOptions,
    IngressVideoEncodingPreset,
    IngressAudioEncodingPreset,
} from 'livekit-server-sdk';

dotenv.config();

const app = express();
app.use(express.json());
const port = process.env.INGRESS_PORT || 4001;

const livekit = new IngressClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
);

app.post('/api/ing', async (req, res) => {
    try {
        const { inputUrl, outputPath } = req.body;
        const opts: CreateIngressOptions = {
            roomName: 'your-room',
            participantIdentity: 'ingress-' + Date.now(),
            participantName: 'ingress-bot',
            video: new IngressVideoOptions({
                encodingOptions: {
                    case: 'preset',
                    value: IngressVideoEncodingPreset.H264_720P_30FPS_3_LAYERS,
                },
            }),
            audio: new IngressAudioOptions({
                encodingOptions: {
                    case: 'preset',
                    value: IngressAudioEncodingPreset.OPUS_STEREO_96KBPS,
                },
            }),
        };

        const ingress = await livekit.createIngress(IngressInput.WHIP_INPUT, opts);
        const ff = execa('ffmpeg', [
            '-i', inputUrl,
            '-c', 'copy',
            outputPath,
        ]);
        ff.stdout?.pipe(process.stdout);
        ff.stderr?.pipe(process.stderr);
        res.json({ success: true, streamKey: ingress.streamKey });
    } catch (e) {
        if (e instanceof Error) {
            console.error(e);
            res.status(500).json({ success: false, error: e.message });
        } else {
            console.error(e);
            res.status(500).json({ success: false, error: 'Unknown error' });
        }
    }
});

createServer(app).listen(port, () =>
    console.log(`✅ ingress-service listening on port ${port}`),
);
