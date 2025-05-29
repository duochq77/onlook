import React, { useState } from 'react';
import { supabase } from '../services/SupabaseService'; // ✅ Đúng đường dẫn thực tế
const FileUploader = ({ label, accept, folder, onUploadComplete }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('');
    const handleUpload = async () => {
        if (!file) {
            setStatus('❌ Chưa chọn file.');
            return;
        }
        setUploading(true);
        setStatus('⏳ Đang upload...');
        const path = `${folder}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
            .from('stream-files') // ✅ Đã đúng bucket
            .upload(path, file, { upsert: true });
        if (error) {
            setStatus(`❌ Upload lỗi: ${error.message}`);
        }
        else {
            const fileUrl = data?.path
                ? `https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/stream-files/${data.path}`
                : '';
            setStatus('✅ Upload thành công!');
            onUploadComplete(fileUrl);
        }
        setUploading(false);
    };
    return (<div className="mb-4">
            <label className="block mb-1 font-medium">{label}</label>
            <input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] || null)}/>
            <button onClick={handleUpload} disabled={uploading} className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                {uploading ? 'Đang upload...' : 'Tải lên'}
            </button>
            {status && <p className="mt-1 text-sm">{status}</p>}
        </div>);
};
export default FileUploader;
