import type { NextApiRequest, NextApiResponse } from 'next'

// ✅ Dynamic import cho "type": "module"
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity, role = 'publisher' } = req.query

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' })
  }

  try {
    const { AccessToken } = await import('livekit-server-sdk')

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity,
        name: identity,
      }
    )

    at.addGrant({
      room: room,
      roomJoin: true,
      canPublish: role === 'publisher',
      canSubscribe: true,
    })

    const jwt = at.toJwt() // ✅ Quan trọng: phải gọi .toJwt()
    console.log('✅ JWT tạo ra:', jwt)

    return res.status(200).json({ token: jwt }) // ✅ Trả về chuỗi token
  } catch (err) {
    console.error('❌ Token creation failed:', err)
    return res.status(500).json({ error: 'Token creation failed' })
  }
}
