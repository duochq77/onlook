import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity } = req.query;

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' });
  }

  try {
    // ✅ Dùng dynamic import để hoạt động đúng với type: "module"
    const { AccessToken } = await import('livekit-server-sdk');

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      { identity }
    );
    at.addGrant({ roomJoin: true, room });

    const jwt = at.toJwt(); // ⚠️ Gọi đúng method
    console.log('✅ Token tạo ra:', jwt);

    return res.status(200).json({ token: jwt });
  } catch (err) {
    console.error('❌ Token creation failed:', err);
    return res.status(500).json({ error: 'Token creation failed' });
  }
}
