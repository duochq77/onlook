// src/pages/seller/upload-original.tsx

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function UploadOriginalPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [status, setStatus] = useState('')

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            setStatus('❌ Vui lòng chọn đủ cả video và audio')
            return
        }

        setStatus('📤 Đang upload...')

        const upload = async (file: File, path: string) => {
            const { error } = await supabase.storage
                .from('uploads')
                .upload(path, file, {
                    upsert: true,
                    contentType: file.type
                })

            if (error) throw error
        }

        try {
            const videoPath = `uploads/${videoFile.name}`
            const audioPath = `uploads/${audioFile.name}`
            const outputName = 'demo-final.mp4'

            await upload(videoFile, videoPath)
            await upload(audioFile, audioPath)

            setStatus('✅ Upload thành công. Đang gửi job xử lý...')

            await fetch('/api/create-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputVideo: videoPath,
                    inputAudio: audioPath,
                    outputName
                })
            })

            setStatus('🚀 Job đã gửi thành công vào Redis!')
        } catch (err: any) {
            console.error(err)
            setStatus(`❌ Lỗi: ${err.message}`)
        }
    }

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
            <h2>📤 Upload Video + Audio (Phương thức 3)</h2>

            <div style={{ marginTop: 20 }}>
                <label>🎬 Video (.mp4): </label>
                <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            </div>

            <div style={{ marginTop: 20 }}>
                <label>🔊 Audio (.mp3): </label>
                <input type="file" accept="audio/mpeg" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </div>

            <button
                onClick={handleUpload}
                style={{ marginTop: 30, padding: '10px 20px', background: '#0070f3', color: 'white', border: 'none' }}
            >
                🚀 Bắt đầu xử lý
            </button>

            <p style={{ marginTop: 20 }}>{status}</p>
        </div>
    )
}
