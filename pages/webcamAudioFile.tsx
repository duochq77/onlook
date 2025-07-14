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

    async function handleStart() {
        if (!mp3File) return alert('Vui lòng chọn file MP3 trước!')
        console.log('STEP 1: Upload file MP3...')
        const fd = new FormData()
        fd.append('file', mp3File)
        fd.append('jobId', jobId.current)
        const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', { method: 'POST', body: fd })
        const ud = await up.json()
        if (!ud.success || !ud.key) return alert('❌ Upload thất bại!')
        uploadedKey.current = ud.key
        const audioUrl = `https://pub-f7639404296d4552819a5bc64f436da7.r2.dev/${ud.key}`
        console.log('Uploaded MP3, URL:', audioUrl)

        console.log('STEP 2: Request token & connect LiveKit...')
        const roomName = 'room-' + jobId.current
        const id = 'seller-' + jobId.current
        const tkRes = await fetch(`/api/token?room=${roomName}&identity=${id}&role=publisher`)
        const { token } = await tkRes.json()
        const room = new Room()
        roomRef.current = room
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
        console.log('Connected to LiveKit')

        console.log('STEP 3: Publish webcam video')
        const cam = await navigator.mediaDevices.getUserMedia({ video: true })
        const vt = cam.getVideoTracks()[0]
        await room.localParticipant.publishTrack(new LocalVideoTrack(vt))
        videoRef.current!.srcObject = new MediaStream([vt])

        console.log('STEP 4: Mix MP3 + mic')
        const ctx = new AudioContext()
        if (ctx.state === 'suspended') await ctx.resume()
        const mp3Buf = await fetch(audioUrl).then(r => r.arrayBuffer())
        const decoded = await ctx.decodeAudioData(mp3Buf)
        const mp3Source = ctx.createBufferSource()
        mp3Source.buffer = decoded
        mp3Source.loop = true
        const mp3Gain = ctx.createGain()
        mp3Gain.gain.value = 1
        mp3Source.connect(mp3Gain)

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const micSrc = ctx.createMediaStreamSource(micStream)
        const micGain = ctx.createGain()
        micGain.gain.value = 1 / 3
        micSrc.connect(micGain)

        const dest = ctx.createMediaStreamDestination()
        mp3Gain.connect(dest)
        micGain.connect(dest)
        mp3Source.start()

        console.log('STEP 5: Publish mixed audio')
        const audioTrack = dest.stream.getAudioTracks()[0]
        await room.localParticipant.publishTrack(new LocalAudioTrack(audioTrack))
        audioRef.current!.srcObject = dest.stream

        setStreaming(true)
    }

    async function handleStop() {
        console.log('STEP 6: Stop stream & clean up')
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
        setStreaming(false)
    }

    return (
        <main className="p-6 space-y-4">
            <h1>🎥 Livestream webcam + MP3</h1>
            <input type="file" accept="audio/mpeg" disabled={streaming} onChange={e => setMp3File(e.target.files?.[0] || null)} />
            <button onClick={handleStart} disabled={!mp3File || streaming}>▶️ Bắt đầu livestream</button>
            <button onClick={handleStop} disabled={!streaming}>⏹️ Kết thúc livestream</button>
            <video ref={videoRef} autoPlay muted className="w-full" />
            <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
        </main>
    )
}
