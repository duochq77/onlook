import type { NextApiRequest, NextApiResponse } from 'next'
import { AccessToken } from 'livekit-server-sdk'

const apiKey = process.env.LIVEKIT_API_KEY!
const apiSecret = process.env.LIVEKIT_API_SECRET!

/**
 * API cấp token truy cập LiveKit
 * Gọi từ client: /api/token?room=abc&identity=xyz&role=subscriber|publisher
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity, role } = req.query

  if (
    typeof room !== 'string' ||
    typeof identity !== 'string' ||
    (role !== 'subscriber' && role !== 'publisher')
  ) {
    return res.status(400).json({ error: 'Missing or invalid room, identity, or role' })
  }

  const at = new AccessToken(apiKey, apiSecret, { identity })
  at.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: role === 'publisher',
  })

  const token = at.toJwt()
  return res.status(200).json({ token })
}
