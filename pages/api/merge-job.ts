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

    const { cleanVideo, audio, outputName } = req.body;

    if (!cleanVideo || !audio || !outputName) {
        return res.status(400).json({ error: 'Thiếu dữ liệu merge job' });
    }

    const jobData = { cleanVideo, audio, outputName };
    const jobDataString = JSON.stringify(jobData);

    try {
        console.log('🎬 Gửi job MERGE:', jobDataString);
        await redis.rpush('ffmpeg-jobs:merge', jobDataString);
        await redis.set(`debug:merge:push:${outputName}`, jobDataString, { ex: 600 });
    } catch (err) {
        console.error('❌ Redis push lỗi:', err);
        return res.status(500).json({ error: 'Redis push failed' });
    }

    return res.status(200).json({ message: '✅ MERGE job đã được tạo' });
}
