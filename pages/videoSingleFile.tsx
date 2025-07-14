'use client'
import React, { useRef, useState } from 'react'
import { Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client'

export default function VideoSingleFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<Room | null>(null)
    const jobId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const uploadedKey = useRef<string | null>(null)

    async function handleStart() {
        if (!videoFile) return alert('Vui lòng chọn video đầu tiên')
        setStreaming(true)
        try {
            console.log('STEP 1: Upload video lên R2...')
            const fd = new FormData()
            fd.append('file', videoFile)
            fd.append('jobId', jobId.current)

            const up = await fetch(
                'https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload',
                { method: 'POST', body: fd }
            )
            const ud = await up.json()
            if (!up.ok || !ud.success || !ud.key) throw new Error(JSON.stringify(ud))
            uploadedKey.current = ud.key

            const endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT!
            const bucket = process.env.NEXT_PUBLIC_R2_BUCKET!
            const videoUrl = `${endpoint}/${bucket}/${ud.key}`
            console.log('✅ Video URL:', videoUrl)

            console.log('STEP 2: Request token & connect LiveKit...')
            const roomName = 'room-' + jobId.current
            const id = 'seller-' + jobId.current
            const tk = await fetch(`/api/token?room=${roomName}&identity=${id}&role=publisher`)
            const { token } = await tk.json()

            const room = new Room()
            roomRef.current = room
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            console.log('✔ Connected LiveKit')

            console.log('STEP 3: Play file và publish track...')
            const videoEl = document.createElement('video')
            videoEl.src = videoUrl
            await videoEl.play().catch(() => {
                console.warn('Playback video tự động thất bại')
            })
            const stream = (videoEl as any).captureStream()
            const vt = stream.getVideoTracks()[0]
            const at = stream.getAudioTracks()[0]

            await room.localParticipant.publishTrack(new LocalVideoTrack(vt))
            await room.localParticipant.publishTrack(new LocalAudioTrack(at))
            videoRef.current!.srcObject = stream

            console.log('✅ Livestream bằng video file đã bắt đầu')
        } catch (e) {
            console.error('❌ Error livestream:', e)
            alert('Lỗi livestream, xem console')
            handleStop()
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
        }
        setStreaming(false)
        console.log('🛑 Livestream stopped')
    }

    return (
        <main className="p-6 space-y-4">
            <h1>🎥 Livestream video file lên LiveKit</h1>
            <input
                type="file"
                accept="video/*"
                disabled={streaming}
                onChange={e => setVideoFile(e.target.files?.[0] || null)}
            />
            <button onClick={handleStart} disabled={!videoFile || streaming}>
                ▶️ Bắt đầu livestream
            </button>
            <button onClick={handleStop} disabled={!streaming}>
                ⏹️ Kết thúc livestream
            </button>
            <video ref={videoRef} autoPlay muted className="w-full" />
        </main>
    )
}
