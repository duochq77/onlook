import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        console.log('❌ Method không hợp lệ:', req.method)
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { outputName } = req.query

    if (!outputName || typeof outputName !== 'string') {
        console.log('❌ Thiếu hoặc sai định dạng outputName:', outputName)
        return res.status(400).json({ error: 'Thiếu hoặc sai định dạng outputName' })
    }

    const filePath = `outputs/${outputName}`
    console.log('🔎 Đang kiểm tra sự tồn tại của file:', filePath)

    // ✅ Kiểm tra file trong thư mục outputs
    const { data: fileList, error } = await supabase
        .storage
        .from(BUCKET)
        .list('outputs', {
            search: outputName,
        })

    if (error) {
        console.error('❌ Lỗi khi list file từ Supabase:', error)
        return res.status(500).json({ error: 'Không kiểm tra được file' })
    }

    console.log('📂 Danh sách file trả về từ Supabase:', fileList)

    const exists = fileList?.some(file => file.name === outputName)
    console.log('✅ File tồn tại?', exists)

    if (!exists) {
        return res.status(200).json({ exists: false })
    }

    // ✅ Tạo signed URL
    const { data: signedData, error: signedError } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrl(filePath, 300)

    if (signedError || !signedData?.signedUrl) {
        console.error('❌ Không tạo được signed URL:', signedError)
        return res.status(500).json({ error: 'Không tạo được signed URL' })
    }

    console.log('🔑 Signed URL tạo thành công:', signedData.signedUrl)

    return res.status(200).json({
        exists: true,
        downloadUrl: signedData.signedUrl,
    })
}
