// pages/api/active-rooms.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { RoomServiceClient } from 'livekit-server-sdk'

// Đọc cấu hình LiveKit từ biến môi trường
const WS_URL = process.env.LIVEKIT_URL!
const API_KEY = process.env.LIVEKIT_API_KEY!
const API_SECRET = process.env.LIVEKIT_API_SECRET!

console.log('📡 LIVEKIT_URL=', WS_URL)
console.log('🔑 LIVEKIT_API_KEY=', API_KEY ? '✔' : '❌ MISSING')
console.log('🔐 LIVEKIT_API_SECRET=', API_SECRET ? '✔' : '❌ MISSING')

// Khởi tạo client LiveKit Server
const svc = new RoomServiceClient(WS_URL, API_KEY, API_SECRET)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        console.log('🛰️ Calling listRooms...')
        const listResp = await svc.listRooms()  // listResp.rooms: RoomInfo[]

        const listData = listResp.rooms
        if (!Array.isArray(listData)) {
            console.error('❗ listResp.rooms invalid:', listResp)
            return res.status(500).json({ error: 'Invalid server response' })
        }

        const rooms = listData.map(r => ({
            room: r.name,
            sellerName: r.metadata || r.name,
            thumbnail: ''  // Có thể parse metadata chứa thumbnail nếu dùng
        }))

        console.log('✅ Active rooms:', rooms.map(r => r.room))
        return res.status(200).json({ rooms })

    } catch (err: any) {
        console.error('❌ /api/active-rooms error:', err)
        return res.status(500).json({
            error: 'Cannot list rooms',
            detail: err?.message || String(err),
        })
    }
}
