// pages/api/active-rooms.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { RoomServiceClient } from 'livekit-server-sdk'

// Đọc biến môi trường để cấu hình LiveKit
const WS_URL = process.env.LIVEKIT_URL!
const API_KEY = process.env.LIVEKIT_API_KEY!
const API_SECRET = process.env.LIVEKIT_API_SECRET!

console.log('📡 LIVEKIT_URL=', WS_URL)
console.log('🔑 LIVEKIT_API_KEY=', API_KEY ? '✔' : '❌ MISSING')
console.log('🔐 LIVEKIT_API_SECRET=', API_SECRET ? '✔' : '❌ MISSING')

const svc = new RoomServiceClient(WS_URL, API_KEY, API_SECRET)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        const roomsRaw = await svc.listRooms()
        // roomsRaw là mảng LiveKit Room 객체
        const rooms = roomsRaw.map(r => ({
            room: r.name,
            sellerName: r.metadata || r.name,
            thumbnail: r.metadata?.thumbnail || ''
        }))
        console.log('✅ Active rooms:', rooms.map(r => r.room))
        return res.status(200).json({ rooms })
    } catch (err: any) {
        console.error('❌ /api/active-rooms error:', err)
        return res.status(500).json({
            error: 'Cannot list rooms',
            detail: err.message
        })
    }
}
