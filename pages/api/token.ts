// ✅ Chuẩn chạy trên server Vercel với "type": "module"
import { NextApiRequest, NextApiResponse } from 'next'

// ✅ API tạo token JWT cho LiveKit (dùng cho cả seller và viewer)
// URL dạng: /api/token?room=ROOM_NAME&identity=UNIQUE_ID&role=publisher|subscriber

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity, role } = req.query

  if (
    !room || !identity || !role ||
    typeof room !== 'string' ||
    typeof identity !== 'string' ||
    typeof role !== 'string' ||
    !['publisher', 'subscriber'].includes(role)
  ) {
    return res.status(400).json({ error: 'Missing or invalid room, identity, or role' })
  }

  try {
    // ✅ Import động để phù hợp khi dùng "type": "module" trong Vercel
    const { AccessToken, RoomServiceClient } = await import('livekit-server-sdk')

    const apiKey = process.env.LIVEKIT_API_KEY!
    const apiSecret = process.env.LIVEKIT_API_SECRET!
    const livekitUrl = process.env.LIVEKIT_URL!

    // ✅ Khởi tạo client để tạo room (nếu chưa có)
    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret)

    // ✅ Tạo room nếu chưa tồn tại, với departureTimeout = 0 để room không tự đóng khi không có người
    await svc.createRoom({ name: room, departureTimeout: 0 }).catch(err => {
      // Nếu room đã tồn tại, chỉ log
      if (!/already exists/.test((err as Error).message)) {
        console.error('🚨 createRoom error:', err)
      }
    })

    // ✅ Tạo AccessToken và phân quyền theo role
    const at = new AccessToken(apiKey, apiSecret, { identity })
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: role === 'publisher',
      canSubscribe: true,
    })

    const jwt = await at.toJwt()
    console.log(`✅ Issued token for ${identity} as ${role} in room ${room}`)
    return res.status(200).json({ token: jwt })

  } catch (err) {
    console.error('❌ Token creation failed:', err)
    return res.status(500).json({ error: 'Token creation failed' })
  }
}
