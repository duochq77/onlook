import { NextApiRequest, NextApiResponse } from 'next';
import { stopLivestream, deleteVideo } from '../../backend/delete';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            await stopLivestream();
            await deleteVideo();
            res.status(200).json({ message: 'Livestream stopped and video deleted' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to stop livestream and delete video' });
        }
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
}
