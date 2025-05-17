// pages/SellerWebcamMicPage.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Room, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client'

const SellerWebcamMicPage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<Room | null>(null)

    useEffect(() => {
        const connectToRoom = async () => {
            const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''
            const roomName = 'default-room'
            const identity = 'seller-' + Math.floor(Math.random() * 10000)

            console.log('🔗 LiveKit URL:', serverUrl)

            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=publisher`)
            const data = await res.json()
            const token = data.token as string

            console.log('🔑 Token:', typeof token, token)

            const room = new Room()
            await room.connect(serverUrl, token, {
                autoSubscribe: false,
            })
            setRoom(room)

            const videoTrack = await createLocalVideoTrack()
            const audioTrack = await createLocalAudioTrack()

            room.localParticipant.publishTrack(videoTrack)
            room.localParticipant.publishTrack(audioTrack)

            console.log('📷 Webcam và 🎤 Mic đã được gửi đi')

            if (videoRef.current) {
                videoTrack.attach(videoRef.current)
            }

            room.on('disconnected', () => {
                setRoom(null)
                videoTrack.stop()
                audioTrack.stop()
            })
        }

        connectToRoom()

        return () => {
            if (room) {
                room.disconnect()
            }
        }
    }, [])

    return (
        <div style={{ padding: 24 }}>
            <h1>🧑‍💼 Livestream người bán (Webcam + Mic)</h1>
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', maxWidth: 600, borderRadius: 12 }}
            />
        </div>
    )
}

export default SellerWebcamMicPage
