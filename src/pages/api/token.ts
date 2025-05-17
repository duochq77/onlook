import type { NextApiRequest, NextApiResponse } from 'next'
import { AccessToken } from 'livekit-server-sdk'

const apiKey = process.env.LIVEKIT_API_KEY || ''
const apiSecret = process.env.LIVEKIT_API_SECRET || ''

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const { room, identity, role } = req.query

    if (!room || !identity || !role) {
        return res.status(400).json({ error: 'Missing room, identity, or role' })
    }

    try {
        const at = new AccessToken(apiKey, apiSecret, {
            identity: identity as string,
        })

        at.addGrant({
            roomJoin: true,
            room: room as string,
            canPublish: role === 'publisher',
            canSubscribe: role === 'subscriber' || role === 'publisher',
        })

        const jwt = at.toJwt() // ✅ CHUỖI JWT thật
        return res.status(200).json({ token: jwt }) // ✅ TRẢ VỀ CHUỖI
    } catch (err) {
        console.error('❌ Token generation failed:', err)
        return res.status(500).json({ error: 'Token generation failed' })
    }
}
