import type { NextApiRequest, NextApiResponse } from 'next'
import { RoomServiceClient } from 'livekit-server-sdk'

const WS_URL = process.env.LIVEKIT_URL!
const API_KEY = process.env.LIVEKIT_API_KEY!
const API_SECRET = process.env.LIVEKIT_API_SECRET!

const svc = new RoomServiceClient(WS_URL, API_KEY, API_SECRET)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        const listResp = await svc.listRooms()
        const listData = listResp.rooms
        if (!Array.isArray(listData)) {
            console.error('❗ listResp.rooms is not array:', listResp)
            return res.status(500).json({ error: 'Invalid server response' })
        }

        const rooms = listData.map(r => {
            let sellerName = r.name
            let thumbnail = ''
            if (typeof r.metadata === 'string' && r.metadata.trim() !== '') {
                try {
                    const meta = JSON.parse(r.metadata)
                    sellerName = meta.sellerName || r.name
                    thumbnail = meta.thumbnail || ''
                } catch (err) {
                    console.warn(`⚠️ Không parse được metadata cho room ${r.name}:`, r.metadata)
                }
            }
            return { room: r.name, sellerName, thumbnail }
        })

        console.log('✅ Active rooms:', rooms.map(r => r.room))
        return res.status(200).json({ rooms })
    } catch (err: any) {
        console.error('❌ /api/active-rooms error:', err)
        return res.status(500).json({
            error: 'Cannot list rooms',
            detail: err?.message || String(err)
        })
    }
}
