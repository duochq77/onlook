// 04. src/components/AdminUploader.tsx

import React, { useState } from 'react'
import { supabase } from '@/services/SupabaseService'

const AdminUploader: React.FC = () => {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [status, setStatus] = useState<string>('')

    const handleUpload = async () => {
        if (!videoFile && !audioFile) {
            setStatus('❌ Chưa chọn file để upload.')
            return
        }

        setStatus('⏳ Đang upload...')

        const uploads: string[] = []

        if (videoFile) {
            const { data, error } = await supabase.storage
                .from('uploads')
                .upload(`sample/video/${videoFile.name}`, videoFile, { upsert: true })

            if (error) {
                setStatus(`❌ Upload video lỗi: ${error.message}`)
                return
            } else {
                uploads.push(`🎥 Video: ${data.path}`)
            }
        }

        if (audioFile) {
            const { data, error } = await supabase.storage
                .from('uploads')
                .upload(`sample/audio/${audioFile.name}`, audioFile, { upsert: true })

            if (error) {
                setStatus(`❌ Upload audio lỗi: ${error.message}`)
                return
            } else {
                uploads.push(`🎧 Audio: ${data.path}`)
            }
        }

        setStatus(`✅ Upload thành công:\n${uploads.join('\n')}`)
    }

    return (
        <div className="bg-white rounded-lg shadow p-6 w-full max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">🎛️ Upload Video & Audio Mẫu (Admin)</h2>

            <div className="mb-4">
                <label className="block mb-1 font-medium">🎥 Chọn video (.mp4)</label>
                <input
                    type="file"
                    accept="video/mp4"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                />
            </div>

            <div className="mb-4">
                <label className="block mb-1 font-medium">🎧 Chọn audio (.mp3)</label>
                <input
                    type="file"
                    accept="audio/mpeg"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                />
            </div>

            <button
                onClick={handleUpload}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
                Upload
            </button>

            <p className="mt-4 text-sm whitespace-pre-line">{status}</p>
        </div>
    )
}

export default AdminUploader
