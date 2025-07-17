"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const port = process.env.DELETE_PORT || 4002;
app.post('/api/end', async (req, res) => {
    try {
        const { key } = req.body;
        const resp = await (0, node_fetch_1.default)(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`, { method: 'DELETE' });
        if (!resp.ok)
            throw new Error(`Delete failed: ${resp.status}`);
        res.json({ success: true });
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
app.listen(port, () => console.log(`✅ delete-service listening on port ${port}`));
