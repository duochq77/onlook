import { RoomServiceClient } from 'livekit-server-sdk'
import dotenv from 'dotenv'

dotenv.config()

const livekitHost = process.env.LIVEKIT_URL!
const apiKey = process.env.LIVEKIT_API_KEY!
const apiSecret = process.env.LIVEKIT_API_SECRET!

const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret)

export async function stopRoom(roomName: string) {
    try {
        await roomService.deleteRoom(roomName)
    } catch (err) {
        if (
            err instanceof Error &&
            err.message.includes('not found')
        ) {
            console.warn(`⚠️ Room ${roomName} không tồn tại hoặc đã bị xóa trước đó`)
        } else {
            throw err
        }
    }
}
