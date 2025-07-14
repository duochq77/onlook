// pages/api/active-rooms.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { RoomServiceClient } from 'livekit-server-sdk'

const WS_URL = process.env.LIVEKIT_URL!
const API_KEY = process.env.LIVEKIT_API_KEY!
const API_SECRET = process.env.LIVEKIT_API_SECRET!
const svc = new RoomServiceClient(WS_URL, API_KEY, API_SECRET)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })
    try {
        console.log('🛰️ Calling svc.listRooms()')
        const resp = await svc.listRooms()
        const roomsArr = resp.rooms
        if (!Array.isArray(roomsArr)) {
            console.error('❗ listResp.rooms invalid:', roomsArr)
            return res.status(500).json({ error: 'Invalid server response' })
        }
        const rooms = roomsArr.map(r => ({
            room: r.name,
            sellerName: r.metadata || r.name,
            thumbnail: '' // nếu metadata chứa thumbnail, parse ra ở đây
        }))
        console.log('✅ Active rooms:', rooms.map(r => r.room))
        return res.status(200).json({ rooms })
    } catch (err: any) {
        console.error('❌ /api/active-rooms error:', err)
        return res.status(500).json({ error: 'Cannot list rooms', detail: err.message })
    }
}
