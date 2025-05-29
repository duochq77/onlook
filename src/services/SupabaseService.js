import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/**
 * Supabase client dùng cho frontend (viewer, seller, admin)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BUCKET = 'stream-files';
/**
 * Trả về public URL từ path nội bộ (outputs/demo.mp4)
 */
export function getPublicUrl(path) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
/**
 * Xoá một file trong bucket (thường dùng sau khi cleanup)
 */
export async function removeFile(path) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error)
        throw error;
}
/**
 * Liệt kê file trong một thư mục (ví dụ: outputs/)
 */
export async function listFiles(prefix) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix);
    if (error)
        throw error;
    return data;
}
