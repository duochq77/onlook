'use client'
import React, { useRef, useState } from 'react'
import { Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client'

export default function WebcamAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [mp3File, setMp3File] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<Room | null>(null)
    const jobId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const uploadedKey = useRef<string | null>(null)

    const handleStart = async () => {
        if (!mp3File) return alert('Chọn MP3 trước!')

        const form = new FormData()
        form.append('file', mp3File)
        form.append('jobId', jobId.current)

        const uploadRes = await fetch('https://upload-audio-worker-…/upload', { method: 'POST', body: form })
        const uploadData = await uploadRes.json()
        const audioUrl = `https://pub-…/${uploadData.key}`
        uploadedKey.current = uploadData.key

        const roomName = 'room-' + jobId.current
        const identity = 'seller-' + jobId.current
        const tokRes = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=publisher`)
        const { token } = await tokRes.json()

        const room = new Room()
        roomRef.current = room
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
        console.log('🔌 Connected LiveKit')

        const cam = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTrack = cam.getVideoTracks()[0]
        const localVid = new LocalVideoTrack(videoTrack)
        await room.localParticipant.publishTrack(localVid)
        videoRef.current!.srcObject = new MediaStream([videoTrack])

        const ctx = new AudioContext()
        const mp3Buf = await (await fetch(audioUrl)).arrayBuffer()
        const decoded = await ctx.decodeAudioData(mp3Buf)
        const mp3Src = ctx.createBufferSource()
        mp3Src.buffer = decoded
        mp3Src.loop = true
        const mp3Gain = ctx.createGain()
        mp3Src.connect(mp3Gain)

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const micSrc = ctx.createMediaStreamSource(micStream)
        const micGain = ctx.createGain()
        micSrc.connect(micGain)

        const dest = ctx.createMediaStreamDestination()
        mp3Gain.connect(dest)
        micGain.connect(dest)
        mp3Src.start()

        const audioTrack = dest.stream.getAudioTracks()[0]
        const localAud = new LocalAudioTrack(audioTrack)
        await room.localParticipant.publishTrack(localAud)

        audioRef.current!.srcObject = dest.stream
        setStreaming(true)
    }

    const handleStop = async () => {
        if (roomRef.current) await roomRef.current.disconnect()
        setStreaming(false)
    }

    return (
        <main className="p-6 max-w-xl mx-auto space-y-4">
            <h1 className="text-xl font-bold">🎥 Livestream webcam + MP3</h1>
            <input type="file" accept="audio/mpeg" onChange={(e) => setMp3File(e.target.files?.[0] || null)} disabled={streaming} />
            <button onClick={handleStart} disabled={!mp3File || streaming} className="bg-blue-600 text-white px-4 py-2 rounded">
                ▶️ Bắt đầu
            </button>
            <button onClick={handleStop} disabled={!streaming} className="bg-red-600 text-white px-4 py-2 rounded">
                ⏹️ Kết thúc
            </button>

            <video ref={videoRef} autoPlay muted className="w-full rounded shadow" />
            <audio autoPlay ref={audioRef} style={{ display: 'none' }} />
        </main>
    )
}
