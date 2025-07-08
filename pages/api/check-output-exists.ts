import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { outputName } = req.query

    if (!outputName || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Thiếu hoặc sai định dạng outputName' })
    }

    const filePath = `outputs/${outputName}`

    // Kiểm tra xem file có tồn tại không
    const { data: fileList, error } = await supabase
        .storage
        .from(BUCKET)
        .list('outputs', {
            search: outputName,
        })

    const exists = fileList?.some(file => file.name === outputName)

    if (!exists) {
        return res.status(200).json({ exists: false })
    }

    // Tạo signed URL có hiệu lực 5 phút (300 giây)
    const { data: signedData, error: signedError } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrl(filePath, 300)

    if (signedError || !signedData?.signedUrl) {
        return res.status(500).json({ error: 'Không tạo được signed URL' })
    }

    // Trả về trạng thái file và URL tải
    return res.status(200).json({
        exists: true,
        downloadUrl: signedData.signedUrl,
    })
}
