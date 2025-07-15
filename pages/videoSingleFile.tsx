'use client'
import React, { useRef, useState } from 'react'
import { Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client'

export default function VideoSingleFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<Room | null>(null)
    const uploadedKey = useRef<string | null>(null)

    async function handleStart() {
        if (!file) return alert('Chọn file MP4 đã nhé!')
        setStreaming(true)
        try {
            console.log('STEP 1: Upload video lên R2...')
            const fd = new FormData()
            fd.append('file', file)
            const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', { method: 'POST', body: fd })
            const ud = await up.json()
            if (!up.ok || !ud.success || !ud.key) throw new Error(JSON.stringify(ud))
            uploadedKey.current = ud.key
            const videoUrl = `https://pub-f7639404296d4552819a5bc64f436da7.r2.dev/${ud.key}`
            console.log('✅ Video URL:', videoUrl)

            console.log('STEP 2: Request token & connect LiveKit...')
            const roomName = 'room-' + Date.now()
            const identity = 'seller-' + roomName
            const tk = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=publisher`)
                .then(r => r.json())
            const room = new Room()
            roomRef.current = room
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, tk.token)
            console.log('✔ Connected LiveKit')

            const vid = videoRef.current!
            vid.crossOrigin = 'anonymous'
            vid.src = videoUrl
            vid.onloadedmetadata = () => console.log('[📌] duration:', vid.duration)
            vid.onplaying = () => console.log('[▶️] Video playing')
            vid.onended = () => { console.log('[🏁] Ended — stop'); handleStop() }
            vid.onerror = e => console.error('[❌] Video error', e)

            await vid.play()

            const stream = vid.captureStream()
            console.log('[🎬] Tracks before fallback—video:', stream.getVideoTracks().length, ', audio:', stream.getAudioTracks().length)

            const vtracks = stream.getVideoTracks()
            const atracks = stream.getAudioTracks()

            if (vtracks.length === 0) throw new Error('Không có video track')
            await room.localParticipant.publishTrack(new LocalVideoTrack(vtracks[0]))

            if (atracks.length > 0) {
                await room.localParticipant.publishTrack(new LocalAudioTrack(atracks[0]))
            }

            console.log('🚀 Published video + audio (nếu có)')
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
        }
        // ✅ Dừng phát video
        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.src = ''
        }

        setStreaming(false)
        console.log('🛑 Livestream stopped')
    }

    return (
        <main>
            <h1>📁 Livestream video file từ R2</h1>
            <input type="file" accept="video/mp4" disabled={streaming} onChange={e => setFile(e.target.files?.[0] || null)} />
            <button onClick={handleStart} disabled={!file || streaming}>▶️ Bắt đầu livestream</button>
            <button onClick={handleStop} disabled={!streaming}>⏹️ Dừng livestream</button>
            <video ref={videoRef} width="640" height="360" muted playsInline style={{ background: '#000' }} />
        </main>
    )
}
