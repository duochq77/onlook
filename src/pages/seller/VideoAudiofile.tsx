'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../services/SupabaseService'

export default function VideoAudioFilePage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [mergedUrl, setMergedUrl] = useState<string | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)

    useEffect(() => {
        if (videoFile && audioFile) handleUpload()
    }, [videoFile, audioFile])

    const handleUpload = async () => {
        setIsProcessing(true)
        const timestamp = Date.now()
        const videoPath = `video-inputs/${timestamp}-video.${videoFile!.name.split('.').pop()}`
        const audioPath = `audio-inputs/${timestamp}-audio.${audioFile!.name.split('.').pop()}`
        const outputName = `${timestamp}-merged.mp4`
        const outputPath = `outputs/${outputName}`

        const videoRes = await supabase.storage.from('stream-files').upload(videoPath, videoFile!, { upsert: true })
        if (videoRes.error) return alert('❌ Upload video thất bại: ' + videoRes.error.message)

        const audioRes = await supabase.storage.from('stream-files').upload(audioPath, audioFile!, { upsert: true })
        if (audioRes.error) return alert('❌ Upload audio thất bại: ' + audioRes.error.message)

        await fetch('/api/create-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputVideo: videoPath, inputAudio: audioPath, outputName })
        })

        // Chờ xử lý
        for (let i = 0; i < 30; i++) {
            const { data } = supabase.storage.from('stream-files').getPublicUrl(outputPath)
            const res = await fetch(data.publicUrl, { method: 'HEAD' })
            if (res.ok) {
                setMergedUrl(data.publicUrl)
                setIsProcessing(false)
                return
            }
            await new Promise((r) => setTimeout(r, 3000))
        }

        alert('❌ Hệ thống xử lý quá lâu.')
        setIsProcessing(false)
    }

    const toggleStream = async () => {
        if (!mergedUrl) return

        if (!isStreaming) {
            alert('▶️ Bắt đầu livestream')
            setIsStreaming(true)
        } else {
            const fileName = `outputs/${mergedUrl.split('/').pop()}`
            await fetch('/api/stop-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName })
            })
            alert('⛔ Đã kết thúc livestream')
            setIsStreaming(false)
        }
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

            {isProcessing && <p>⏳ Đang xử lý file...</p>}

            {mergedUrl && (
                <button
                    onClick={toggleStream}
                    style={{
                        padding: 10,
                        background: isStreaming ? '#f44' : '#28a745',
                        color: 'white',
                        marginTop: 10
                    }}
                >
                    {isStreaming ? '⛔ Kết thúc livestream' : '▶️ Bắt đầu livestream'}
                </button>
            )}

            {mergedUrl && (
                <div style={{ marginTop: 20 }}>
                    <a href={mergedUrl} download>
                        ⬇️ Tải video hoàn chỉnh
                    </a>
                    <p style={{ color: 'orange', fontSize: 13 }}>
                        ⚠️ File này sẽ được xoá khỏi hệ thống sau 10 phút kể từ khi kết thúc livestream.
                    </p>
                </div>
            )}
        </div>
    )
}
