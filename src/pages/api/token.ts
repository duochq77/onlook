// ✅ Chuẩn chạy trên server Vercel với "type": "module"
import { NextApiRequest, NextApiResponse } from 'next'

// ✅ API tạo token JWT cho LiveKit (dùng cho cả seller và viewer)
// URL dạng: /api/token?room=ROOM_NAME&identity=UNIQUE_ID&role=publisher|subscriber

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity } = req.query

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' })
  }

  try {
    // ✅ Import động để phù hợp khi dùng "type": "module" trong Vercel
    const { AccessToken } = await import('livekit-server-sdk')

    const apiKey = process.env.LIVEKIT_API_KEY!
    const apiSecret = process.env.LIVEKIT_API_SECRET!

    // ✅ Tạo token JWT với quyền join vào room
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
    })
    at.addGrant({ roomJoin: true, room })

    const jwt = await at.toJwt()

    console.log('✅ Token tạo ra:', jwt)
    return res.status(200).json({ token: jwt })
  } catch (err) {
    console.error('❌ Token creation failed:', err)
    return res.status(500).json({ error: 'Token creation failed' })
  }
}
