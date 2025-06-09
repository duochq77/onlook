import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoogleAccessToken } from '@/utils/getGoogleToken'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

    const { videoUrl, audioUrl, outputName } = req.body

    if (!videoUrl || !audioUrl || !outputName) {
        return res.status(400).json({ error: 'Thiếu videoUrl, audioUrl hoặc outputName' })
    }

    let accessToken: string
    try {
        accessToken = await getGoogleAccessToken()
    } catch (err) {
        console.error('❌ Lỗi lấy Google token:', err)
        return res.status(500).json({ error: 'Không lấy được access token từ Google' })
    }

    console.log('🚀 Gửi job Cloud Run...')
    const triggerRes = await fetch(`${process.env.CLOUD_RUN_URL}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            taskOverrides: {
                env: [
                    { name: 'OUTPUT_NAME', value: outputName },
                    { name: 'INPUT_VIDEO_URL', value: videoUrl },
                    { name: 'INPUT_AUDIO_URL', value: audioUrl },
                ],
            },
        }),
    })

    if (!triggerRes.ok) {
        const errorText = await triggerRes.text()
        console.error('❌ Cloud Run lỗi:', errorText)
        return res.status(500).json({ error: 'Không gọi được job xử lý', detail: errorText })
    }

    console.log('✅ Job xử lý đã gửi thành công.')
    return res.status(200).json({ outputName })
}
