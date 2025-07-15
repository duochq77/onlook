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
            const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
                method: 'POST',
                body: fd
            })
            const ud = await up.json()
            if (!up.ok || !ud.success || !ud.key) throw new Error('Upload lỗi')
            uploadedKey.current = ud.key
            const videoUrl = `https://pub-f7639404296d4552819a5bc64f436da7.r2.dev/${ud.key}`
            console.log('✅ Video URL:', videoUrl)

            console.log('STEP 2: Connect LiveKit...')
            const roomName = 'room-' + Date.now()
            const identity = 'seller-' + roomName
            const { token } = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=publisher`)
                .then(r => r.json())
            const room = new Room()
            roomRef.current = room
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            console.log('✔ Connected LiveKit')

            console.log('STEP 3: Play & capture')
            const vid = videoRef.current!
            vid.src = videoUrl
            vid.crossOrigin = 'anonymous'
            vid.muted = false
            vid.volume = 0.5

            vid.onended = () => {
                console.log('🏁 Video ended — stop livestream')
                handleStop()
            }

            await vid.play().catch(e => console.warn('play() interrupted — continue', e))

            let stream = vid.captureStream()
            console.log('[🎬] Tracks video:', stream.getVideoTracks().length, 'audio:', stream.getAudioTracks().length)

            if (stream.getAudioTracks().length === 0) {
                console.log('[⏳] Fallback WebAudio')
                const ac = new AudioContext()
                const src = ac.createMediaElementSource(vid)
                const dest = ac.createMediaStreamDestination()
                src.connect(dest)
                stream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()])
                console.log('[🎧] Now have audio')
            }

            const vtrack = stream.getVideoTracks()[0]
            const atrack = stream.getAudioTracks()[0]

            await room.localParticipant.publishTrack(new LocalVideoTrack(vtrack))
            if (atrack) await room.localParticipant.publishTrack(new LocalAudioTrack(atrack))
            console.log('🚀 Published both tracks!')

        } catch (e: any) {
            console.error('❌ Error livestream:', e)
            alert('Phát livestream lỗi — xem console!')
            await handleStop()
        }
    }

    async function handleStop() {
        console.log('🛑 Stopping livestream...')
        if (roomRef.current) {
            await roomRef.current.disconnect()
            roomRef.current = null
        }
        if (uploadedKey.current) {
            await fetch('https://delete-audio-worker-729288097042.asia-southeast1.run.app/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: uploadedKey.current })
            })
            uploadedKey.current = null
            console.log('🧹 Deleted from R2')
        }
        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.src = ''
        }
        setStreaming(false)
        console.log('✅ Livestream fully stopped')
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
                playsInline
                style={{ background: '#000' }}
            />
        </main>
    )
}
