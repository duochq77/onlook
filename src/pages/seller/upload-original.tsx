'use client'

import { useState } from 'react'
import { supabase } from '../../services/SupabaseService' // ✅ Dùng client chung đã khai báo

export default function UploadOriginalPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [mergedUrl, setMergedUrl] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            alert('Vui lòng chọn cả video và audio')
            return
        }

        setIsProcessing(true)
        const timestamp = Date.now()
        const videoExt = videoFile.name.split('.').pop()
        const audioExt = audioFile.name.split('.').pop()

        const videoPath = `video-inputs/${timestamp}-video.${videoExt}`
        const audioPath = `audio-inputs/${timestamp}-audio.${audioExt}`
        const outputName = `${timestamp}-merged.mp4`
        const outputPath = `outputs/${outputName}`

        // Upload video
        const videoRes = await supabase.storage
            .from('stream-files')
            .upload(videoPath, videoFile, { upsert: true })

        if (videoRes.error) {
            alert('❌ Upload video thất bại: ' + videoRes.error.message)
            setIsProcessing(false)
            return
        }

        // Upload audio
        const audioRes = await supabase.storage
            .from('stream-files')
            .upload(audioPath, audioFile, { upsert: true })

        if (audioRes.error) {
            alert('❌ Upload audio thất bại: ' + audioRes.error.message)
            setIsProcessing(false)
            return
        }

        // Gửi job xử lý
        await fetch('/api/create-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputVideo: videoPath,
                inputAudio: audioPath,
                outputName
            })
        })

        // Kiểm tra kết quả đầu ra
        const checkFinalFile = async () => {
            for (let i = 0; i < 30; i++) {
                const { data } = supabase.storage
                    .from('stream-files')
                    .getPublicUrl(outputPath)

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
        const fileName = `outputs/${mergedUrl?.split('/').pop()}`
        await fetch('/api/stop-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName })
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
                    <button
                        onClick={() => alert('▶️ Đã sẵn sàng livestream')}
                        style={{ padding: 10, background: '#28a745', color: 'white' }}
                    >
                        ▶️ Bắt đầu livestream
                    </button>

                    <div style={{ marginTop: 20 }}>
                        <a href={mergedUrl} download>
                            ⬇️ Tải video hoàn chỉnh
                        </a>
                    </div>

                    <button
                        onClick={handleStop}
                        style={{ marginTop: 12, padding: 10, background: '#f44', color: 'white' }}
                    >
                        ⛔ Kết thúc livestream
                    </button>
                </>
            )}
        </div>
    )
}
