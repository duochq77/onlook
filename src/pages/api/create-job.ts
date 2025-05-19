// src/pages/api/create-job.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { inputVideo, inputAudio, outputName } = req.body;

    if (!inputVideo || !inputAudio || !outputName) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const job = JSON.stringify({ inputVideo, inputAudio, outputName });
        await redis.rpush('ffmpeg-jobs', job);
        return res.status(200).json({ message: 'Job added to queue' });
    } catch (err) {
        console.error('❌ Failed to add job:', err);
        return res.status(500).json({ error: 'Failed to add job to queue' });
    }
}
