"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
const execa_1 = require("execa");
const livekit_server_sdk_1 = require("livekit-server-sdk");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const port = process.env.INGRESS_PORT || 4001;
const livekit = new livekit_server_sdk_1.IngressClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
app.post('/api/ing', async (req, res) => {
    try {
        const { inputUrl, outputPath } = req.body;
        const opts = {
            roomName: 'your-room',
            participantIdentity: 'ingress-' + Date.now(),
            participantName: 'ingress-bot',
            video: new livekit_server_sdk_1.IngressVideoOptions({
                encodingOptions: {
                    case: 'preset',
                    value: livekit_server_sdk_1.IngressVideoEncodingPreset.H264_720P_30FPS_3_LAYERS,
                },
            }),
            audio: new livekit_server_sdk_1.IngressAudioOptions({
                encodingOptions: {
                    case: 'preset',
                    value: livekit_server_sdk_1.IngressAudioEncodingPreset.OPUS_STEREO_96KBPS,
                },
            }),
        };
        const ingress = await livekit.createIngress(livekit_server_sdk_1.IngressInput.WHIP_INPUT, opts);
        const ff = (0, execa_1.execa)('ffmpeg', [
            '-i', inputUrl,
            '-c', 'copy',
            outputPath,
        ]);
        ff.stdout?.pipe(process.stdout);
        ff.stderr?.pipe(process.stderr);
        res.json({ success: true, streamKey: ingress.streamKey });
    }
    catch (e) {
        if (e instanceof Error) {
            console.error(e);
            res.status(500).json({ success: false, error: e.message });
        }
        else {
            console.error(e);
            res.status(500).json({ success: false, error: 'Unknown error' });
        }
    }
});
(0, http_1.createServer)(app).listen(port, () => console.log(`✅ ingress-service listening on port ${port}`));
