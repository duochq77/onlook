import { NextApiRequest, NextApiResponse } from 'next'

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
    const { AccessToken, RoomServiceClient } = await import('livekit-server-sdk')
    const apiKey = process.env.LIVEKIT_API_KEY!
    const apiSecret = process.env.LIVEKIT_API_SECRET!
    const livekitUrl = process.env.LIVEKIT_URL!

    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret)

    await svc.createRoom({ name: room, departureTimeout: 0 }).catch(err => {
      if (!/already exists/.test((err as Error).message)) {
        console.error(err)
      }
    })

    const at = new AccessToken(apiKey, apiSecret, { identity })
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: role === 'publisher',
      canSubscribe: true,
    })

    const jwt = await at.toJwt()
    return res.status(200).json({ token: jwt })
  } catch (err) {
    return res.status(500).json({ error: 'Token creation failed' })
  }
}
