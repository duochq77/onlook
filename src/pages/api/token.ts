import { NextApiRequest, NextApiResponse } from 'next';
const { AccessToken } = require('livekit-server-sdk');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { room, identity } = req.query;

  if (!room || !identity || typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'Missing room or identity' });
  }

  try {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity }
    );

    at.addGrant({ roomJoin: true, room });

    const jwt = at.toJwt(); // 🟢 Chính xác
    console.log('✅ JWT tạo ra:', jwt);

    return res.status(200).json({ token: jwt }); // 🟢 Phải là chuỗi
  } catch (err) {
    console.error('❌ Token creation failed:', err);
    return res.status(500).json({ error: 'Token creation failed' });
  }
}
