import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const config = {
    api: { bodyParser: true },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { outputName } = req.body;

    if (!outputName) {
        return res.status(400).json({ error: 'Thiếu outputName để xóa livestream' });
    }

    try {
        console.log('⛔ Kết thúc livestream:', outputName);
        await redis.set(`livestream:end:${outputName}`, 'true', { ex: 600 });
    } catch (err) {
        console.error('❌ Redis set lỗi:', err);
        return res.status(500).json({ error: 'Redis set failed' });
    }

    return res.status(200).json({ message: '✅ Livestream đã kết thúc, sẽ xóa file sau 10 phút' });
}
