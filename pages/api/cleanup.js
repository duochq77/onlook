import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export default async function handler(req, res) {
    const { prefix } = req.body;
    if (!prefix) {
        return res.status(400).json({ message: 'Thiếu prefix để xóa file' });
    }
    // Lấy danh sách file trong thư mục outputs/
    const { data: files, error } = await supabase.storage
        .from('uploads')
        .list('outputs', { limit: 100 });
    if (error) {
        return res.status(500).json({ message: 'Lỗi khi lấy danh sách file', error });
    }
    const filePaths = files.map((f) => `${prefix}${f.name}`);
    const { error: deleteError } = await supabase.storage
        .from('uploads')
        .remove(filePaths);
    if (deleteError) {
        return res.status(500).json({ message: 'Lỗi khi xoá file', error: deleteError });
    }
    return res.status(200).json({ message: 'Đã xoá file thành công' });
}
