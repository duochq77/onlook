import { NextApiRequest, NextApiResponse } from 'next'
import { RoomServiceClient } from 'livekit-server-sdk'

const svc = new RoomServiceClient(process.env.LIVEKIT_URL!, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })
    try {
        const list = await svc.listRooms()
        const rooms = list.rooms.map(r => ({
            room: r.name,
            sellerName: r.metadata || r.name,
            thumbnail: ''
        }))
        console.log('Active rooms:', rooms.map(r => r.room))
        return res.status(200).json({ rooms })
    } catch (err) {
        console.error('Failed listRooms:', err)
        return res.status(500).json({ error: 'Cannot list rooms' })
    }
}
