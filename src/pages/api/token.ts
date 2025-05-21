import { NextApiRequest, NextApiResponse } from 'next';
import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity, role } = req.query;

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
  });

  at.addGrant({ roomJoin: true, room });

  const token = at.toJwt();
  return res.status(200).json({ token }); // ✅ Đảm bảo trả về đúng { token: "..." }
}
