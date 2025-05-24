'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function UploadOriginalPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)
    const [mergedUrl, setMergedUrl] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('Vui lòng chọn cả video và audio')

        const videoExt = videoFile.name.split('.').pop()
        const audioExt = audioFile.name.split('.').pop()

        const videoPath = `uploads/${Date.now()}-video.${videoExt}`
        const audioPath = `uploads/${Date.now()}-audio.${audioExt}`
        const outputName = 'demo-final.mp4'

        // Upload video
        await supabase.storage.from('uploads').upload(videoPath, videoFile)
        await supabase.storage.from('uploads').upload(audioPath, audioFile)

        // Gửi job vào Redis (thông qua API)
        await fetch('/api/create-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputVideo: videoPath,
                inputAudio: audioPath,
                outputName
            })
        })

        setIsStreaming(true)

        // Lấy public URL để hiển thị nút tải sau khi xử lý
        const { data } = supabase.storage.from('uploads').getPublicUrl(`outputs/${outputName}`)
        setMergedUrl(data.publicUrl)
    }

    const handleStop = async () => {
        await fetch('/api/stop-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: 'demo-final.mp4' })
        })
        setIsStreaming(false)
    }

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
            <h1>📤 Seller: Upload video + audio để phát livestream</h1>

            <div style={{ marginBottom: 12 }}>
                <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            </div>

            <div style={{ marginBottom: 12 }}>
                <input type="file" accept="audio/mp3" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </div>

            {!isStreaming && (
                <button onClick={handleUpload} style={{ padding: 10, marginRight: 10 }}>
                    ▶️ Bắt đầu livestream
                </button>
            )}

            {isStreaming && (
                <button onClick={handleStop} style={{ padding: 10, background: '#f44', color: 'white' }}>
                    ⛔ Kết thúc livestream
                </button>
            )}

            {mergedUrl && (
                <div style={{ marginTop: 20 }}>
                    <a href={mergedUrl} download>
                        ⬇️ Tải video hoàn chỉnh
                    </a>
                </div>
            )}
        </div>
    )
}
