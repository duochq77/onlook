// ✅ Dành cho "type": "module" - chuẩn chạy trên Vercel
import { NextApiRequest, NextApiResponse } from 'next';
import pkg from 'livekit-server-sdk';
const { AccessToken } = pkg;

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity } = req.query;

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' });
  }

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
    at.addGrant({ roomJoin: true, room });

    const token = at.toJwt();
    console.log('✅ Token từ server:', token);

    return res.status(200).json({ token }); // ✅ Trả đúng chuỗi
  } catch (err) {
    console.error('❌ Token creation failed:', err);
    return res.status(500).json({ error: 'Token creation failed' });
  }
}
