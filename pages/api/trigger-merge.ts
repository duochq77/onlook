import type { NextApiRequest, NextApiResponse } from 'next'
import { exec } from 'child_process'

export const config = {
    runtime: 'edge', // có thể dùng 'nodejs' nếu môi trường bạn cần
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    console.log('🚀 Đang gọi job MERGE...')

    exec(
        `gcloud run jobs execute merge-video-worker --region=asia-southeast1 --project=onlook-main --wait`,
        (err, stdout, stderr) => {
            if (err) {
                console.error('❌ Lỗi khi gọi job merge:', stderr)
                return res.status(500).json({ error: 'Lỗi khi gọi job merge' })
            }
            console.log('✅ Đã gọi job MERGE:', stdout)
            return res.status(200).json({ message: 'MERGE job executed' })
        }
    )
}
