import type { NextApiRequest, NextApiResponse } from 'next'
import { exec } from 'child_process'

export const config = {
    api: {
        bodyParser: false,
    },
}

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
    const jobName = 'clean-video-worker'
    const region = 'asia-southeast1'
    const project = process.env.GOOGLE_CLOUD_PROJECT_ID!

    const command = `gcloud run jobs execute ${jobName} --region=${region} --project=${project} --wait`

    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error('❌ Lỗi khi gọi gcloud job:', err)
            return res.status(500).json({ error: 'Trigger clean job failed', detail: stderr })
        }

        console.log('🚀 Đã gọi job clean thành công:\n', stdout)
        return res.status(200).json({ message: 'Triggered clean-video-worker' })
    })
}
