'use client'
import React, { useRef, useState } from 'react'
import { Room, LocalVideoTrack } from 'livekit-client'

export default function VideoSingleFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<Room | null>(null)
    const uploadedKey = useRef<string | null>(null)

    async function handleStart() {
        if (!file) return alert('Vui lòng chọn file MP4 trước!')
        setStreaming(true)
        try {
            // STEP 1: Upload MP4 lên R2
            const fd = new FormData()
            fd.append('file', file)
            console.log('STEP 1: Upload video lên R2...')
            const up = await fetch(
                'https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload',
                { method: 'POST', body: fd }
            )
            const ud = await up.json()
            if (!up.ok || !ud.success || !ud.key) throw new Error(JSON.stringify(ud))
            uploadedKey.current = ud.key
            const videoUrl = `https://pub-f7639404296d4552819a5bc64f436da7.r2.dev/${ud.key}`
            console.log('✅ Video URL (pub...r2.dev):', videoUrl)

            // STEP 2: Lấy token & connect LiveKit
            console.log('STEP 2: Request token & connect LiveKit...')
            const roomName = 'room-' + Date.now()
            const identity = 'seller-' + roomName
            const tkRes = await fetch(
                `/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=publisher`
            )
            const { token } = await tkRes.json()
            const room = new Room()
            roomRef.current = room
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            console.log('✔ Connected LiveKit')

            // STEP 3: Play video, capture stream & publish
            console.log('STEP 3: Play video và publish track...')
            const vid = videoRef.current!
            vid.src = videoUrl
            vid.crossOrigin = 'anonymous'
            await vid.play()
            const stream = vid.captureStream()
            const track = stream.getVideoTracks()[0]
            await room.localParticipant.publishTrack(new LocalVideoTrack(track))
            console.log('🚀 Video file đã được publish')

        } catch (e) {
            console.error('❌ Error livestream:', e)
            alert('Phát livestream lỗi, xem console!')
            await handleStop()
        }
    }

    async function handleStop() {
        if (roomRef.current) {
            await roomRef.current.disconnect()
            roomRef.current = null
        }
        if (uploadedKey.current) {
            await fetch(
                'https://delete-audio-worker-729288097042.asia-southeast1.run.app/delete',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: uploadedKey.current })
                }
            )
            uploadedKey.current = null
            console.log('🧹 Video file trên R2 đã được xóa')
        }
        setStreaming(false)
        console.log('🛑 Livestream stopped')
    }

    return (
        <main className="p-6 space-y-4">
            <h1>📁 Livestream video file từ R2</h1>
            <input
                type="file"
                accept="video/mp4"
                disabled={streaming}
                onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <button onClick={handleStart} disabled={!file || streaming}>
                ▶️ Bắt đầu livestream
            </button>
            <button onClick={handleStop} disabled={!streaming}>
                ⏹️ Dừng livestream
            </button>
            <video ref={videoRef} width="640" height="360" hidden muted playsInline />
        </main>
    )
}
