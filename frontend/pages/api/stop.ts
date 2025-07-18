import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { room, key } = req.body

    if (!room || !key) {
        return res.status(400).json({ error: 'Thiếu ROOM hoặc FILE_KEY' })
    }

    try {
        const response = await fetch(process.env.DELETE_WORKER_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room, key }),
        })

        if (!response.ok) {
            const error = await response.text()
            return res.status(500).json({ error: 'Gọi delete worker thất bại', detail: error })
        }

        res.status(200).json({ message: '✅ Đã gửi yêu cầu xoá livestream và video' })
    } catch (err) {
        res.status(500).json({ error: '❌ Lỗi khi gọi worker', detail: String(err) })
    }
}
