// pages/api/active-rooms.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    // 🔧 Giả lập danh sách room đang livestream
    const activeRooms = [
        {
            room: 'room-1752291477780-lduwai6ci7',
            sellerName: 'Shop A',
            thumbnail: 'https://via.placeholder.com/300x500?text=Shop+A',
        },
        {
            room: 'room-1752291509999-xye7u5ei9w',
            sellerName: 'Shop B',
            thumbnail: 'https://via.placeholder.com/300x500?text=Shop+B',
        },
        {
            room: 'room-1752291530000-mnszxp8qpj',
            sellerName: 'Shop C',
            thumbnail: 'https://via.placeholder.com/300x500?text=Shop+C',
        },
    ]

    return res.status(200).json({ rooms: activeRooms })
}
