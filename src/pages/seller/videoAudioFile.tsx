export const dynamic = 'force-dynamic'

import React, { useState, useRef, useEffect } from 'react'
const livekit = require('livekit-client')

export default function VideoAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const videoContainerRef = useRef<HTMLDivElement>(null)

    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [mergedURL, setMergedURL] = useState<string>('')
    const [room, setRoom] = useState<any>(null)
    const [isStreaming, setIsStreaming] = useState(false)
    const [uploading, setUploading] = useState(false)

    const identity = 'seller-' + Math.floor(Math.random() * 100000)
    const roomName = identity // mỗi seller 1 phòng riêng
    const role = 'publisher'

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            alert('Vui lòng chọn cả video và audio.')
            return
        }

        setUploading(true)

        const videoData = new FormData()
        videoData.append('file', videoFile)
        videoData.append('path', `video-${identity}.mp4`)
        await fetch('/api/upload', { method: 'POST', body: videoData })

        const audioData = new FormData()
        audioData.append('file', audioFile)
        audioData.append('path', `audio-${identity}.mp3`)
        await fetch('/api/upload', { method: 'POST', body: audioData })

        // Gửi job tách video sạch
        await fetch('/api/clean-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputVideo: `video-${identity}.mp4`,
                outputName: `clean-${identity}.mp4`
            })
        })

        // Gửi job merge
        await fetch('/api/merge-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoFile: `clean-${identity}.mp4`,
                audioFile: `audio-${identity}.mp3`,
                outputName: `merged-${identity}.mp4`
            })
        })

        const mergedURL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/outputs/merged-${identity}.mp4`
        setMergedURL(mergedURL)
        setUploading(false)
    }

    const startStream = async () => {
        if (!mergedURL) return

        const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`)
        const { token } = await res.json()

        const room = new livekit.Room()
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token)
        setRoom(room)

        const videoEl = videoRef.current!
        videoEl.src = mergedURL
        videoEl.loop = true
        videoEl.muted = true
        await videoEl.play()

        const stream = videoEl.captureStream?.() || (videoEl as any).mozCaptureStream?.()
        const videoTrack = stream.getVideoTracks()[0]
        const audioTrack = stream.getAudioTracks()[0]

        if (videoTrack) {
            const localVideoTrack = new livekit.LocalVideoTrack(videoTrack)
            await room.localParticipant.publishTrack(localVideoTrack)
            const attached = localVideoTrack.attach()
            if (videoContainerRef.current) {
                videoContainerRef.current.innerHTML = ''
                videoContainerRef.current.appendChild(attached)
            }
        }

        if (audioTrack) {
            const localAudioTrack = new livekit.LocalAudioTrack(audioTrack)
            await room.localParticipant.publishTrack(localAudioTrack)
        }

        setIsStreaming(true)
    }

    const stopStream = async () => {
        if (room) {
            room.disconnect()
            setRoom(null)
        }

        setIsStreaming(false)
        await fetch(`/api/stop-stream?userId=${identity}`)
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold">📽️ Livestream từ video sạch + audio riêng</h1>

            <div className="space-y-2">
                <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                <input type="file" accept="audio/mp3" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                <button onClick={handleUpload} className="bg-blue-500 text-white px-4 py-2 rounded" disabled={uploading}>
                    {uploading ? '⏳ Đang xử lý...' : '📦 Bắt đầu xử lý file'}
                </button>
            </div>

            {mergedURL && !isStreaming && (
                <button
                    onClick={startStream}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
                >
                    ▶️ Bắt đầu Stream
                </button>
            )}

            {isStreaming && (
                <button
                    onClick={stopStream}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
                >
                    ⛔ Kết thúc Stream
                </button>
            )}

            <div className="mt-4">
                <div ref={videoContainerRef} />
                <video ref={videoRef} hidden />
            </div>
        </div>
    )
}
