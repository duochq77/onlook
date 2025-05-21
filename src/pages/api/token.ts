// ✅ Chuẩn chạy trên server Vercel với "type": "module"
import { NextApiRequest, NextApiResponse } from 'next'

// ⚠️ Đảm bảo import động vì đang dùng "type": "module"
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity } = req.query

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' })
  }

  try {
    // ✅ Import động để tránh lỗi bundler khi deploy
    const { AccessToken } = await import('livekit-server-sdk')

    // ✅ Dùng biến môi trường đã được Vercel khai đúng
    const apiKey = process.env.LIVEKIT_API_KEY!
    const apiSecret = process.env.LIVEKIT_API_SECRET!

    // ✅ Tạo token mới
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
    })
    at.addGrant({ roomJoin: true, room })

    // ⚠️ KHÔNG quên gọi await .toJwt()
    const jwt = await at.toJwt()

    console.log('✅ Token tạo ra:', jwt)
    return res.status(200).json({ token: jwt })
  } catch (err) {
    console.error('❌ Token creation failed:', err)
    return res.status(500).json({ error: 'Token creation failed' })
  }
}
