'use client'

import { useState } from 'react'
import { supabase } from '../../services/SupabaseService'

export default function VideoAudioFilePage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('❗ Chưa chọn đủ file')

        setIsUploading(true)

        const timestamp = Date.now()
        const inputVideo = `input/${timestamp}-video.mp4`
        const inputAudio = `input/${timestamp}-audio.mp3`
        const outputName = `${timestamp}-merged.mp4`

        const res1 = await supabase.storage.from('stream-files').upload(inputVideo, videoFile, { upsert: true })
        if (res1.error) {
            alert('❌ Upload video thất bại: ' + res1.error.message)
            return setIsUploading(false)
        }

        const res2 = await supabase.storage.from('stream-files').upload(inputAudio, audioFile, { upsert: true })
        if (res2.error) {
            alert('❌ Upload audio thất bại: ' + res2.error.message)
            return setIsUploading(false)
        }

        const res = await fetch('/api/create-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputVideo, outputName }) // ✅ chỉ gửi video
        })

        if (!res.ok) {
            alert('❌ Gửi job xử lý thất bại')
            return setIsUploading(false)
        }

        alert('✅ Đã gửi job xử lý vào hệ thống')
        setIsUploading(false)
    }

    return (
        <div style={{ padding: 40 }}>
            <h2>📤 Seller: Upload video + audio để livestream</h2>

            <div style={{ marginBottom: 12 }}>
                <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            </div>

            <div style={{ marginBottom: 12 }}>
                <input type="file" accept="audio/mp3" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </div>

            <button
                onClick={handleUpload}
                disabled={isUploading}
                style={{
                    padding: 10,
                    background: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: isUploading ? 'not-allowed' : 'pointer'
                }}
            >
                {isUploading ? '⏳ Đang upload...' : '🚀 Gửi xử lý'}
            </button>
        </div>
    )
}
