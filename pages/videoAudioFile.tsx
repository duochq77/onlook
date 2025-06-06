// Force rebuild on Vercel: 2025-06-06
'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/services/SupabaseService'

export default function VideoAudioFilePage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [mergedUrl, setMergedUrl] = useState<string | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)
    const [outputName, setOutputName] = useState<string>('')

    const handleVideoChange = (e) => {
        setVideoFile(e.target.files?.[0] || null)
    }

    const handleAudioChange = (e) => {
        setAudioFile(e.target.files?.[0] || null)
    }

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('Vui lòng chọn đầy đủ video và audio')

        setIsProcessing(true)
        const timestamp = Date.now()
        const videoPath = `input-videos/${timestamp}-video.mp4`
        const audioPath = `input-audios/${timestamp}-audio.mp3`
        const mergedOutput = `${timestamp}-merged.mp4`
        const outputPath = `outputs/${mergedOutput}`
        setOutputName(mergedOutput)

        // Upload video
        const videoRes = await supabase.storage.from('stream-files').upload(videoPath, videoFile, { upsert: true })
        if (videoRes.error) {
            alert('❌ Upload video thất bại: ' + videoRes.error.message)
            setIsProcessing(false)
            return
        }

        // Upload audio
        const audioRes = await supabase.storage.from('stream-files').upload(audioPath, audioFile, { upsert: true })
        if (audioRes.error) {
            alert('❌ Upload audio thất bại: ' + audioRes.error.message)
            setIsProcessing(false)
            return
        }

        // Gửi job CLEAN
        const res = await fetch('/api/clean-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputVideo: videoPath, outputName: mergedOutput }),
        })

        const result = await res.json()
        if (!res.ok) {
            alert('❌ Tạo job clean thất bại: ' + (result.error || res.statusText))
            setIsProcessing(false)
            return
        }

        // Theo dõi kết quả merge và lấy signed URL
        for (let i = 0; i < 30; i++) {
            const { data } = await supabase.storage.from('stream-files').createSignedUrl(outputPath, 60)
            if (data?.signedUrl) {
                const res = await fetch(data.signedUrl)
                if (res.ok) {
                    setMergedUrl(data.signedUrl)
                    setIsProcessing(false)
                    return
                }
            }
            await new Promise((r) => setTimeout(r, 3000))
        }

        alert('❌ Xử lý quá lâu, thử lại sau.')
        setIsProcessing(false)
    }

    const toggleStream = async () => {
        if (!mergedUrl) return

        if (!isStreaming) {
            alert('▶️ Bắt đầu livestream')
            setIsStreaming(true)
        } else {
            alert('⛔ Kết thúc livestream (sẽ xoá file sau 5 phút)')
            setIsStreaming(false)

            // Gửi tín hiệu dừng stream
            await fetch('/api/stop-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputName }),
            })
        }
    }

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
            <h1>📤 Upload video + audio để phát livestream</h1>

            <input type="file" accept="video/mp4" onChange={handleVideoChange} style={{ marginBottom: 12 }} />
            <input type="file" accept="audio/mp3" onChange={handleAudioChange} style={{ marginBottom: 12 }} />

            <button
                onClick={handleUpload}
                style={{
                    padding: 10,
                    background: '#007bff',
                    color: 'white',
                    marginTop: 10,
                    border: 'none',
                    borderRadius: 6
                }}
                disabled={!videoFile || !audioFile || isProcessing}
            >
                ⏫ Upload và xử lý
            </button>

            {isProcessing && <p>⏳ Đang xử lý video + audio...</p>}

            {mergedUrl && (
                <>
                    <button
                        onClick={toggleStream}
                        style={{
                            padding: 10,
                            background: isStreaming ? '#dc3545' : '#28a745',
                            color: 'white',
                            marginTop: 20,
                            borderRadius: 6
                        }}
                    >
                        {isStreaming ? '⛔ Kết thúc livestream' : '▶️ Bắt đầu livestream'}
                    </button>

                    <div style={{ marginTop: 20 }}>
                        <a href={mergedUrl} download>⬇️ Tải video hoàn chỉnh</a>
                        <p style={{ color: 'orange', fontSize: 13 }}>
                            ⚠️ File đã merge, sẽ tự động xoá sau khi kết thúc livestream.
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
