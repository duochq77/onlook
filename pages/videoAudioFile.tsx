'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/services/SupabaseService'

export default function VideoAudioFilePage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [mergedUrl, setMergedUrl] = useState<string | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return
        setIsProcessing(true)

        const timestamp = Date.now()
        const videoPath = `input-videos/${timestamp}-video.mp4`
        const audioPath = `input-audios/${timestamp}-audio.mp3`
        const outputName = `${timestamp}-merged.mp4`
        const outputPath = `outputs/${outputName}`

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

        // Gửi job CLEAN (tạo clean.mp4 từ video gốc)
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/create-clean-job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputVideo: videoPath, outputName })
        })

        // Theo dõi khi file merged xuất hiện → hiện nút livestream
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
            alert('⛔ Đã kết thúc livestream (file chưa xoá)')
            setIsStreaming(false)
        }
    }

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
            <h1>📤 Upload video + audio để phát livestream</h1>

            <div style={{ marginBottom: 12 }}>
                <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            </div>

            <div style={{ marginBottom: 12 }}>
                <input type="file" accept="audio/mp3" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </div>

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
                        <a href={mergedUrl} download>
                            ⬇️ Tải video hoàn chỉnh
                        </a>
                        <p style={{ color: 'orange', fontSize: 13 }}>
                            ⚠️ File đã merge, giữ lại để kiểm tra lỗi nếu cần.
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
