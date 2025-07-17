import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(express.json());
const port = process.env.DELETE_PORT || 4002;

app.post('/api/end', async (req, res) => {
    try {
        const { key } = req.body;
        const resp = await fetch(
            `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`,
            { method: 'DELETE' }
        );
        if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
        res.json({ success: true });
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

app.listen(port, () =>
    console.log(`✅ delete-service listening on port ${port}`),
);
