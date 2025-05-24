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

        const timestamp = Date.now()
        const videoPath = `uploads/${timestamp}-video.${videoExt}`
        const audioPath = `uploads/${timestamp}-audio.${audioExt}`
        const outputName = 'demo-final.mp4'

        // Upload video & audio lên Supabase
        await supabase.storage.from('uploads').upload(videoPath, videoFile)
        await supabase.storage.from('uploads').upload(audioPath, audioFile)

        // Gửi job xử lý video
        await fetch('/api/create-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputVideo: videoPath,
                inputAudio: audioPath,
                outputName,
                roomName: 'test-room' // ⬅️ cần khớp với Viewer
            })
        })

        setIsStreaming(true)

        // Hiển thị URL video đã xử lý sau khi merge xong
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

            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            <br /><br />
            <input type="file" accept="audio/mp3" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            <br /><br />

            {!isStreaming ? (
                <button onClick={handleUpload}>▶️ Bắt đầu livestream</button>
            ) : (
                <button onClick={handleStop} style={{ background: 'red', color: 'white' }}>
                    ⛔ Kết thúc livestream
                </button>
            )}

            {mergedUrl && (
                <div style={{ marginTop: 20 }}>
                    <a href={mergedUrl} download>⬇️ Tải video hoàn chỉnh</a>
                </div>
            )}
        </div>
    )
}
