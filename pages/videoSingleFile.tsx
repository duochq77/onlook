'use client'
import React, { useRef, useState } from 'react'
import { Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client'

export default function VideoWithAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<Room | null>(null)
    const uploadedVideoKey = useRef<string | null>(null)
    const uploadedAudioKey = useRef<string | null>(null)

    async function handleStart() {
        if (!videoFile || !audioFile) return alert('Chọn cả video MP4 và audio MP3 nhé!')
        setStreaming(true)

        try {
            // --- 1️⃣ Upload video + audio lên R2 ---
            const upload = async (file: File) => {
                const fd = new FormData()
                fd.append('file', file)
                const res = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
                    method: 'POST', body: fd
                })
                const { success, key } = await res.json()
                if (!res.ok || !success || !key) throw new Error('Upload failed: ' + file.name)
                return key
            }
            uploadedVideoKey.current = await upload(videoFile)
            uploadedAudioKey.current = await upload(audioFile)
            const videoUrl = `https://pub‑…r2.dev/${uploadedVideoKey.current}`
            const audioUrl = `https://pub‑…r2.dev/${uploadedAudioKey.current}`
            console.log('✅ URLs:', { videoUrl, audioUrl })

            // --- 2️⃣ Connect LiveKit ---
            const roomName = 'room-' + Date.now()
            const identity = 'uploader-' + roomName
            const { token } = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=publisher`)
                .then(r => r.json())
            const room = new Room()
            roomRef.current = room
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            console.log('✔ Connected to LiveKit')

            // --- 3️⃣ Play video + audio via Web Audio API ---
            const vid = videoRef.current!
            vid.crossOrigin = 'anonymous'
            vid.src = videoUrl
            vid.muted = true  // video mute, audio comes from MP3

            const ctx = new AudioContext()
            await ctx.resume()

            // Video audio track (optional for sync)
            const videoStream = vid.captureStream()
            const vtrack = videoStream.getVideoTracks()[0]

            // Load and decode MP3
            const buf = await fetch(audioUrl).then(r => r.arrayBuffer())
            const decoded = await ctx.decodeAudioData(buf)
            const src = ctx.createBufferSource()
            src.buffer = decoded
            src.loop = false

            // Video as silent source (for sync)
            const med = ctx.createMediaElementSource(vid)

            const dest = ctx.createMediaStreamDestination()
            med.connect(dest) // video audio goes silent
            src.connect(dest)

            vid.play().catch(_ => { })
            src.start()

            // --- 4️⃣ Publish video + merged audio ---
            await room.localParticipant.publishTrack(new LocalVideoTrack(vtrack))
            const audioTrack = dest.stream.getAudioTracks()[0]
            await room.localParticipant.publishTrack(new LocalAudioTrack(audioTrack))
            console.log('🚀 Published combined streams')

        } catch (err) {
            console.error(err)
            alert('Có lỗi, xem console')
            await handleStop()
        }
    }

    async function handleStop() {
        if (roomRef.current) {
            await roomRef.current.disconnect()
            roomRef.current = null
        }
        for (const keyRef of [uploadedVideoKey, uploadedAudioKey]) {
            if (keyRef.current) {
                await fetch('https://delete-audio-worker-729288097042.asia-southeast1.run.app/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: keyRef.current })
                })
                keyRef.current = null
            }
        }
        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.src = ''
        }
        setStreaming(false)
    }

    return (
        <main>
            <h1>🎥 Livestream Video + Audio File</h1>
            <input type="file" accept="video/mp4" disabled={streaming} onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            <input type="file" accept="audio/*" disabled={streaming} onChange={e => setAudioFile(e.target.files?.[0] || null)} />
            <button onClick={handleStart} disabled={!videoFile || !audioFile || streaming}>▶ Bắt đầu livestream</button>
            <button onClick={handleStop} disabled={!streaming}>⏹ Dừng livestream</button>
            <video ref={videoRef} width={640} height={360} playsInline style={{ background: '#000' }} />
        </main>
    )
}
