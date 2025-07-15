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
            console.log('STEP 1: Upload video lên R2...')
            const fd = new FormData()
            fd.append('file', file)
            const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
                method: 'POST',
                body: fd,
            })
            const ud = await up.json()
            if (!up.ok || !ud.success || !ud.key) throw new Error(JSON.stringify(ud))
            uploadedKey.current = ud.key
            const videoUrl = `https://pub-f7639404296d4552819a5bc64f436da7.r2.dev/${ud.key}`
            console.log('✅ Video URL:', videoUrl)

            console.log('STEP 2: Request token & connect LiveKit...')
            const roomName = 'room-' + Date.now()
            const identity = 'seller-' + roomName
            const tkRes = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=publisher`)
            const { token } = await tkRes.json()
            const room = new Room()
            roomRef.current = room
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            console.log('✔ Connected LiveKit')

            console.log('STEP 3: Play video và publish track...')
            const vid = videoRef.current!
            vid.crossOrigin = 'anonymous'
            vid.src = videoUrl

            vid.onloadedmetadata = () => console.log('[📌]', 'Metadata, duration:', vid.duration)
            vid.onwaiting = () => console.log('[⏳]', 'Buffering...')
            vid.onplaying = () => console.log('[▶️]', 'Video playing')
            vid.onended = () => {
                console.log('[🏁]', 'Video ended – stopping livestream')
                handleStop()
            }
            vid.onerror = (e) => console.error('[❌]', 'Video element error', e)

            await vid.play()

            const stream = vid.captureStream()
            console.log('[🎬]', 'Captured track count:', stream.getVideoTracks().length)
            const track = stream.getVideoTracks()[0]
            if (!track) {
                throw new Error('No video track captured – likely CORS issue or cross-origin blocked')
            }

            await room.localParticipant.publishTrack(new LocalVideoTrack(track))
            console.log('🚀 Video file đã được publish')
            // Luồng vẫn giữ cho đến khi video ends hoặc user stop
        } catch (e: any) {
            console.error('❌ Error livestream:', e)
            alert('Phát livestream lỗi – xem console!')
            await handleStop()
        }
    }

    async function handleStop() {
        if (roomRef.current) {
            await roomRef.current.disconnect()
            roomRef.current = null
        }
        if (uploadedKey.current) {
            await fetch('https://delete-audio-worker-729288097042.asia-southeast1.run.app/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: uploadedKey.current }),
            })
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
            <video
                ref={videoRef}
                width="640"
                height="360"
                muted
                playsInline
                style={{ background: '#000' }}
            />
        </main>
    )
}
