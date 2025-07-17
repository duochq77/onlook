import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';
import dotenv from 'dotenv';
dotenv.config();

export async function uploadToR2(filePath: string, key: string) {
    const body = new FormData();
    body.append('file', fs.createReadStream(filePath));
    const res = await fetch(
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: fs.createReadStream(filePath),
        }
    );
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
    return `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}
