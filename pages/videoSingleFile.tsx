'use client'
import React, { useRef, useState } from 'react'
import { Room, LocalVideoTrack } from 'livekit-client'

export default function VideoSingleFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [streaming, setStreaming] = useState(false)
    const roomRef = useRef<Room | null>(null)
    const uploadedKey = useRef<string | null>(null)
    const jobId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)

    async function handleStart() {
        if (!videoFile) return alert('Chọn file video trước!')

        console.log('STEP 1: Upload video lên R2...')
        const fd = new FormData()
        fd.append('file', videoFile)
        fd.append('jobId', jobId.current)

        const upRes = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
            method: 'POST',
            body: fd,
        })
        const upJson = await upRes.json()
        if (!upJson.success || !upJson.key) {
            return alert('❌ Upload thất bại')
        }
        uploadedKey.current = upJson.key
        const videoUrl = upJson.url as string
        console.log('✅ Upload xong, URL:', videoUrl)

        console.log('STEP 2: Lấy token & connect LiveKit')
        const roomName = 'room-video-' + jobId.current
        const identity = 'seller-video-' + jobId.current
        const tkRes = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=publisher`)
        const { token } = await tkRes.json()
        const room = new Room()
        roomRef.current = room
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
        console.log('🔗 Kết nối LiveKit thành công')

        console.log('STEP 3: Play video & publish track')
        const videoEl = document.createElement('video')
        videoEl.src = videoUrl
        await videoEl.play()
        const stream = videoEl.captureStream()
        const vidTrack = stream.getVideoTracks()[0]
        await room.localParticipant.publishTrack(new LocalVideoTrack(vidTrack))
        videoRef.current!.srcObject = new MediaStream([vidTrack])
        console.log('🎥 Đã publish video track')

        setStreaming(true)
    }

    async function handleStop() {
        console.log('STEP 4: Stop livestream & cleanup')
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
            console.log('🗑️ Đã xóa file R2:', uploadedKey.current)
            uploadedKey.current = null
        }

        setStreaming(false)
    }

    return (
        <main className="p-6 space-y-4 max-w-xl mx-auto">
            <h1 className="text-xl font-bold">🎬 Livestream từ file video hiện có</h1>
            <input
                type="file"
                accept="video/*"
                disabled={streaming}
                onChange={e => setVideoFile(e.target.files?.[0] || null)}
            />
            <div className="flex gap-2">
                <button
                    onClick={handleStart}
                    disabled={!videoFile || streaming}
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                    ▶️ Bắt đầu livestream
                </button>
                <button
                    onClick={handleStop}
                    disabled={!streaming}
                    className="px-4 py-2 bg-red-600 text-white rounded"
                >
                    ⏹️ Kết thúc livestream
                </button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded shadow" />
        </main>
    )
}
