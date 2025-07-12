'use client'
import React, { useRef, useState } from 'react'
const livekit = require('livekit-client')

export default function WebcamAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [mp3File, setMp3File] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<any>(null)
    const jobId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const uploadedKey = useRef<string | null>(null)
    const destRef = useRef<MediaStreamAudioDestinationNode | null>(null)

    const handleStart = async () => {
        if (!mp3File) return alert('Vui lòng chọn file MP3 trước!')

        console.log('📤 Đang upload file MP3:', mp3File.name)

        const formData = new FormData()
        formData.append('file', mp3File)
        formData.append('jobId', jobId.current)

        const uploadRes = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
            method: 'POST',
            body: formData,
        })

        if (!uploadRes.ok) {
            console.error('❌ Upload thất bại:', uploadRes.status)
            return alert(`❌ Upload MP3 thất bại: ${uploadRes.status}`)
        }

        const uploadData = await uploadRes.json()
        if (!uploadData.success || !uploadData.key) {
            console.error('❌ Server không trả về key hợp lệ:', uploadData)
            return alert('❌ Upload MP3 thất bại (không có key trả về)')
        }

        const audioUrl = `https://pub-f7639404296d4552819a5bc64f436da7.r2.dev/${uploadData.key}`
        uploadedKey.current = uploadData.key
        console.log('✅ Đã upload xong. URL file MP3:', audioUrl)

        const roomName = 'room-' + jobId.current
        const identity = 'seller-' + jobId.current
        const tokenRes = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=publisher`)
        const { token } = await tokenRes.json()

        const room = new livekit.Room()
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token)
        roomRef.current = room
        console.log('🔌 Đã kết nối LiveKit')

        const camStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTrack = camStream.getVideoTracks()[0]
        const localVideoTrack = new livekit.LocalVideoTrack(videoTrack)
        await room.localParticipant.publishTrack(localVideoTrack)
        videoRef.current!.srcObject = new MediaStream([videoTrack])
        console.log('📷 Đã phát video webcam')

        const ctx = new AudioContext()
        const mp3Res = await fetch(audioUrl)

        if (!mp3Res.ok) {
            console.error('❌ Không fetch được MP3:', mp3Res.status)
            return alert(`❌ CORS hoặc URL lỗi: ${mp3Res.status}`)
        }

        const mp3Buffer = await mp3Res.arrayBuffer()
        if (mp3Buffer.byteLength === 0) {
            return alert('❌ File MP3 bị rỗng hoặc bị chặn.')
        }

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
        destRef.current = dest

        const audioTrack = dest.stream.getAudioTracks()[0]
        const localAudioTrack = new livekit.LocalAudioTrack(audioTrack)
        await room.localParticipant.publishTrack(localAudioTrack)
        console.log('🎵 Đã phát âm thanh mix (mic + mp3)')

        // 🎧 Gắn stream ra loa người bán
        if (audioRef.current) {
            audioRef.current.srcObject = dest.stream
        }

        setStreaming(true)
    }

    const handleStop = async () => {
        if (roomRef.current) {
            roomRef.current.disconnect()
        }

        if (uploadedKey.current) {
            console.log('🧼 Đang xoá file MP3:', uploadedKey.current)
            await fetch('https://delete-audio-worker-729288097042.asia-southeast1.run.app/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: uploadedKey.current }),
            })
        }

        setStreaming(false)
    }

    return (
        <main className="p-6 max-w-xl mx-auto space-y-4">
            <h1 className="text-xl font-bold">🎥 Livestream webcam + file MP3 người bán upload</h1>
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

            {/* 🎧 Loa ẩn để người bán nghe thấy stream mix */}
            <audio
                autoPlay
                ref={audioRef}
                style={{ display: 'none' }}
            />
        </main>
    )
}
