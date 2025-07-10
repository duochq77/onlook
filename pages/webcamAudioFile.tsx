'use client'
import React, { useRef, useState } from 'react'
const livekit = require('livekit-client')

export default function WebcamAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [mp3File, setMp3File] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<any>(null)
    const jobId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const uploadedKey = useRef<string | null>(null)

    const handleStart = async () => {
        if (!mp3File) return alert('Vui lòng chọn file MP3 trước!')

        // 1. Upload MP3 lên Cloudflare R2
        const formData = new FormData()
        formData.append('file', mp3File)
        formData.append('jobId', jobId.current)

        const uploadRes = await fetch('/api/upload-audio-to-r2', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json()
        if (!uploadData.success) return alert('❌ Upload MP3 thất bại')
        const audioUrl = uploadData.url
        uploadedKey.current = uploadData.key

        // 2. Tạo room + kết nối LiveKit
        const roomName = 'room-' + jobId.current
        const identity = 'seller-' + jobId.current
        const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=publisher`)
        const { token } = await res.json()
        const room = new livekit.Room()
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token)
        roomRef.current = room

        // 3. Lấy video từ webcam
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTrack = camStream.getVideoTracks()[0]
        const localVideoTrack = new livekit.LocalVideoTrack(videoTrack)
        await room.localParticipant.publishTrack(localVideoTrack)
        videoRef.current!.srcObject = new MediaStream([videoTrack])

        // 4. Trộn MP3 + mic
        const ctx = new AudioContext()
        const mp3Response = await fetch(audioUrl)
        const mp3Buffer = await mp3Response.arrayBuffer()
        const decoded = await ctx.decodeAudioData(mp3Buffer)
        const mp3Source = ctx.createBufferSource()
        mp3Source.buffer = decoded
        mp3Source.loop = true

        const mp3Gain = ctx.createGain()
        mp3Gain.gain.value = 1
        mp3Source.connect(mp3Gain)

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const micSource = ctx.createMediaStreamSource(micStream)
        const micGain = ctx.createGain()
        micGain.gain.value = 1 / 3
        micSource.connect(micGain)

        const dest = ctx.createMediaStreamDestination()
        mp3Gain.connect(dest)
        micGain.connect(dest)
        mp3Source.start()

        const audioTrack = dest.stream.getAudioTracks()[0]
        const localAudioTrack = new livekit.LocalAudioTrack(audioTrack)
        await room.localParticipant.publishTrack(localAudioTrack)

        setStreaming(true)
    }

    const handleStop = async () => {
        if (roomRef.current) {
            roomRef.current.disconnect()
        }

        // Gọi API xoá file từ R2
        if (uploadedKey.current) {
            await fetch('/api/delete-audio-from-r2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: uploadedKey.current }),
            })
        }

        setStreaming(false)
    }

    return (
        <main className="p-6 max-w-xl mx-auto space-y-4">
            <h1 className="text-xl font-bold">🎥 Livestream webcam + audio MP3</h1>

            <input
                type="file"
                accept="audio/mpeg"
                onChange={(e) => setMp3File(e.target.files?.[0] || null)}
                disabled={streaming}
            />

            <button
                onClick={handleStart}
                disabled={!mp3File || streaming}
                className="bg-blue-600 text-white px-4 py-2 rounded"
            >
                ▶️ Bắt đầu livestream
            </button>

            <button
                onClick={handleStop}
                disabled={!streaming}
                className="bg-red-600 text-white px-4 py-2 rounded"
            >
                ⏹️ Kết thúc livestream
            </button>

            <video ref={videoRef} autoPlay muted className="w-full rounded shadow" />
        </main>
    )
}
