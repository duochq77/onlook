import { NextApiRequest, NextApiResponse } from 'next'
const { AccessToken } = require('livekit-server-sdk')

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity } = req.query

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' })
  }

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity })
    at.addGrant({ roomJoin: true, room })

    const token = at.toJwt()
    console.log('✅ JWT Token tạo ra:', token)

    return res.status(200).json({ token }) // ✅ Token là chuỗi JWT đúng chuẩn
  } catch (err) {
    console.error('❌ Lỗi khi tạo token:', err)
    return res.status(500).json({ error: 'Token creation failed' })
  }
}
