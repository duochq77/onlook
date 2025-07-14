'use client'
import React, { useRef, useState } from 'react'
import { Room, LocalVideoTrack } from 'livekit-client'

export default function VideoSingleFilePage() {
    const videoEl = useRef<HTMLVideoElement>(null)
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<Room | null>(null)
    const jobId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const uploadedKey = useRef<string | null>(null)

    async function handleStart() {
        if (!videoFile) return alert('Chọn video trước nhé!')
        console.log('STEP 1: Upload video lên R2...')
        const fd = new FormData()
        fd.append('file', videoFile)
        fd.append('jobId', jobId.current)
        const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
            method: 'POST',
            body: fd
        })
        const ud = await up.json()
        if (!ud.success || !ud.key) return alert('❌ Upload thất bại!')
        uploadedKey.current = ud.key
        const videoUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${ud.key}`
        console.log('✅ Upload xong, URL:', videoUrl)

        console.log('STEP 2: Lấy token & connect LiveKit...')
        const roomName = 'room-' + jobId.current
        const id = 'seller-' + jobId.current
        const tkRes = await fetch(`/api/token?room=${roomName}&identity=${id}&role=publisher`)
        const { token } = await tkRes.json()
        const room = new Room()
        roomRef.current = room
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
        console.log('🔗 Kết nối LiveKit thành công')

        console.log('STEP 3: Play video & publish track')
        const stream = await videoEl.current!.captureStream()
        const vt = stream.getVideoTracks()[0]
        const at = stream.getAudioTracks()[0]
        await room.localParticipant.publishTrack(new LocalVideoTrack(vt))
        if (at) await room.localParticipant.publishTrack(at)
        videoEl.current!.srcObject = stream
        videoEl.current!.play()
        setStreaming(true)
    }

    async function handleStop() {
        console.log('STEP 4: Stop & clean up')
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
    }

    return (
        <main className="p-6 space-y-4">
            <h1>🎥 Livestream video file</h1>
            <input type="file" accept="video/*" disabled={streaming} onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            <button onClick={handleStart} disabled={!videoFile || streaming}>▶️ Bắt đầu livestream</button>
            <button onClick={handleStop} disabled={!streaming}>⏹️ Kết thúc livestream</button>
            <video ref={videoEl} controls className="w-full max-h-[60vh]" />
        </main>
    )
}
