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
    const [isProcessing, setIsProcessing] = useState(false)
    const [mergedUrl, setMergedUrl] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('Vui lòng chọn cả video và audio')
        setIsProcessing(true)

        const videoExt = videoFile.name.split('.').pop()
        const audioExt = audioFile.name.split('.').pop()
        const timestamp = Date.now()

        const videoPath = `uploads/${timestamp}-video.${videoExt}`
        const audioPath = `uploads/${timestamp}-audio.${audioExt}`
        const outputName = `demo-final.mp4`

        await supabase.storage.from('uploads').upload(videoPath, videoFile)
        await supabase.storage.from('uploads').upload(audioPath, audioFile)

        await fetch('/api/create-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputVideo: videoPath,
                inputAudio: audioPath,
                outputName,
            }),
        })

        // Đợi xử lý xong video (poll mỗi 3s)
        const checkFinalFile = async () => {
            for (let i = 0; i < 30; i++) {
                const { data } = supabase.storage.from('uploads').getPublicUrl(`outputs/${outputName}`)
                const res = await fetch(data.publicUrl, { method: 'HEAD' })
                if (res.ok) {
                    setMergedUrl(data.publicUrl)
                    setIsProcessing(false)
                    return
                }
                await new Promise((r) => setTimeout(r, 3000))
            }

            alert('❌ Hệ thống xử lý quá lâu. Vui lòng thử lại sau.')
            setIsProcessing(false)
        }

        checkFinalFile()
    }

    const handleStop = async () => {
        await fetch('/api/stop-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: 'demo-final.mp4' }),
        })
        alert('✅ Đã gửi tín hiệu kết thúc stream.')
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

            <button
                onClick={handleUpload}
                style={{ padding: 10, marginRight: 10 }}
                disabled={isProcessing}
            >
                📤 Gửi file và xử lý
            </button>

            {mergedUrl && (
                <>
                    <button onClick={() => alert('▶️ Đã sẵn sàng livestream')} style={{ padding: 10, background: '#28a745', color: 'white' }}>
                        ▶️ Bắt đầu livestream
                    </button>

                    <div style={{ marginTop: 20 }}>
                        <a href={mergedUrl} download>
                            ⬇️ Tải video hoàn chỉnh
                        </a>
                    </div>

                    <button onClick={handleStop} style={{ marginTop: 12, padding: 10, background: '#f44', color: 'white' }}>
                        ⛔ Kết thúc livestream
                    </button>
                </>
            )}
        </div>
    )
}
