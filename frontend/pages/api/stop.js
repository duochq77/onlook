"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
function handler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        const { room, key } = req.body;
        if (!room || !key) {
            return res.status(400).json({ error: 'Thiếu ROOM hoặc FILE_KEY' });
        }
        try {
            const response = yield fetch(process.env.DELETE_WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, key }),
            });
            if (!response.ok) {
                const error = yield response.text();
                return res.status(500).json({ error: 'Gọi delete worker thất bại', detail: error });
            }
            res.status(200).json({ message: '✅ Đã gửi yêu cầu xoá livestream và video' });
        }
        catch (err) {
            res.status(500).json({ error: '❌ Lỗi khi gọi worker', detail: String(err) });
        }
    });
}
