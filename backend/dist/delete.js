"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const r2_1 = require("./utils/r2");
const livekit_1 = require("./utils/livekit");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
app.use(express_1.default.json());
// Endpoint kiểm tra trạng thái service
app.get('/', (_, res) => {
    res.send('✅ Delete worker is running');
});
// Endpoint nhận yêu cầu xoá video và dừng phòng
app.post('/', async (req, res) => {
    const { room, key } = req.body;
    if (!room || !key) {
        return res.status(400).json({ error: 'Thiếu ROOM hoặc FILE_KEY' });
    }
    try {
        console.log(`🛑 Dừng phòng LiveKit: ${room}`);
        await (0, livekit_1.stopRoom)(room);
        console.log(`🧹 Xóa file từ R2: ${key}`);
        await (0, r2_1.deleteFromR2)(key);
        res.status(200).json({ message: '✅ Đã xoá video và dừng livestream' });
    }
    catch (err) {
        console.error('❌ Lỗi xử lý:', err);
        res.status(500).json({ error: 'Xoá thất bại', detail: String(err) });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Delete worker listening on port ${PORT}`);
});
