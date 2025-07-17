import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const filePath = path.join(process.cwd(), 'uploads', 'video.mp4');
        const writeStream = fs.createWriteStream(filePath);

        req.pipe(writeStream);

        req.on('end', () => {
            res.status(200).json({ message: 'File uploaded successfully' });
        });

        req.on('error', (err) => {
            res.status(500).json({ error: 'Failed to upload file' });
        });
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
}
