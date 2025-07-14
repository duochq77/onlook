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
        if (!mp3File) return alert('Vui lòng chọn MP3')
        setStreaming(true)
        try {
            const fd = new FormData()
            fd.append('file', mp3File)
            fd.append('jobId', jobId.current)
            console.log('STEP 1: Upload MP3...')
            const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
                method: 'POST', body: fd
            })
            const ud = await up.json()
            if (!up.ok || !ud.success || !ud.key) throw new Error(JSON.stringify(ud))
            uploadedKey.current = ud.key

            const account = process.env.NEXT_PUBLIC_R2_ACCOUNT_ID!
            const bucket = process.env.NEXT_PUBLIC_R2_BUCKET_NAME!
            const audioUrl = `https://${account}.r2.cloudflarestorage.com/${bucket}/${ud.key}`
            console.log('✅ Audio URL:', audioUrl)

            console.log('STEP 2: Kết nối LiveKit...')
            const roomName = 'room-' + jobId.current
            const id = 'seller-' + jobId.current
            const tk = await fetch(`/api/token?room=${roomName}&identity=${id}&role=publisher`)
            const { token } = await tk.json()
            const room = new Room()
            roomRef.current = room
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            console.log('✔ Connected LiveKit')

            console.log('STEP 3: Publish video')
            const cam = await navigator.mediaDevices.getUserMedia({ video: true })
            const vt = cam.getVideoTracks()[0]
            await room.localParticipant.publishTrack(new LocalVideoTrack(vt))
            videoRef.current!.srcObject = new MediaStream([vt])

            console.log('STEP 4 & 5: Mix audio và publish')
            const ctx = new AudioContext()
            if (ctx.state === 'suspended') await ctx.resume()
            const mp3Buf = await fetch(audioUrl).then(r => r.arrayBuffer())
            const decoded = await ctx.decodeAudioData(mp3Buf)
            const mp3Src = ctx.createBufferSource()
            mp3Src.buffer = decoded; mp3Src.loop = true
            const mp3Gain = ctx.createGain(); mp3Gain.gain.value = 1
            mp3Src.connect(mp3Gain)

            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const micSrc = ctx.createMediaStreamSource(micStream)
            const micGain = ctx.createGain(); micGain.gain.value = 1 / 3
            micSrc.connect(micGain)

            const dest = ctx.createMediaStreamDestination()
            mp3Gain.connect(dest); micGain.connect(dest)
            mp3Src.start()

            const audioTrack = dest.stream.getAudioTracks()[0]
            await room.localParticipant.publishTrack(new LocalAudioTrack(audioTrack))
            audioRef.current!.srcObject = dest.stream

            console.log('✅ Livestream bắt đầu')
        } catch (e) {
            console.error('❌ Error livestream:', e)
            alert('Phát livestream lỗi, xem console')
            handleStop()
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
                body: JSON.stringify({ key: uploadedKey.current })
            })
            uploadedKey.current = null
        }
        setStreaming(false)
        console.log('🛑 Livestream stopped')
    }

    return (
        <main className="p-6 space-y-4">
            <h1>🎥 Livestream webcam + MP3</h1>
            <input type="file" accept="audio/mpeg" disabled={streaming} onChange={e => setMp3File(e.target.files?.[0] || null)} />
            <button onClick={handleStart} disabled={!mp3File || streaming}>▶️ Bắt đầu</button>
            <button onClick={handleStop} disabled={!streaming}>⏹️ Dừng</button>
            <video ref={videoRef} autoPlay muted className="w-full" />
            <audio ref={audioRef} autoPlay hidden />
        </main>
    )
}
