"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopRoom = stopRoom;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const livekitHost = process.env.LIVEKIT_URL;
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const roomService = new livekit_server_sdk_1.RoomServiceClient(livekitHost, apiKey, apiSecret);
async function stopRoom(roomName) {
    try {
        await roomService.deleteRoom(roomName);
    }
    catch (err) {
        if (err instanceof Error &&
            err.message.includes('not found')) {
            console.warn(`⚠️ Room ${roomName} không tồn tại hoặc đã bị xóa trước đó`);
        }
        else {
            throw err;
        }
    }
}
