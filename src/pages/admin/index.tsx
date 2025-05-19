import React, { useState } from 'react'
import { supabase } from '@/services/SupabaseService'

const AdminPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)

        const filePath = `samples/${Date.now()}-${file.name}`
        const { error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(filePath, file)

        setUploading(false)

        if (error) {
            alert('Upload failed: ' + error.message)
        } else {
            const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/${filePath}`
            setUploadedUrl(publicUrl)
        }
    }

    return (
        <div style={{ padding: '2rem' }}>
            <h2>📤 Tải lên video mẫu cho nền tảng</h2>
            <input
                type="file"
                accept="video/mp4"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
                onClick={handleUpload}
                disabled={uploading}
                style={{ marginTop: '1rem' }}
            >
                {uploading ? 'Đang tải lên...' : 'Tải lên'}
            </button>

            {uploadedUrl && (
                <p style={{ marginTop: '1rem' }}>
                    ✅ Đã upload: <a href={uploadedUrl} target="_blank">{uploadedUrl}</a>
                </p>
            )}
        </div>
    )
}

export default AdminPage
