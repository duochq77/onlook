// pages/api/active-rooms.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { RoomServiceClient } from 'livekit-server-sdk'

// Khởi tạo RoomServiceClient để quản lý và liệt kê phòng
const svc = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Chỉ hỗ trợ GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        // Lấy danh sách phòng đang tồn tại
        const list = await svc.listRooms()
        // Chuyển đổi format để client dễ sử dụng
        const rooms = list.rooms.map(r => ({
            room: r.name,
            sellerName: r.metadata || r.name,
            thumbnail: '' // có thể bổ sung thumbnail nếu metadata có
        }))

        console.log('✅ Active rooms:', rooms.map(r => r.room))
        return res.status(200).json({ rooms })
    } catch (err: any) {
        console.error('❌ /api/active-rooms error:', err)
        // Trả JSON rõ ràng, không trả HTML
        return res.status(500).json({
            error: 'Cannot list rooms',
            detail: err.message || String(err)
        })
    }
}
