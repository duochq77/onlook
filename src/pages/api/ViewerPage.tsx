// pages/ViewerPage.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Room, RemoteTrackPublication, Participant, Track, connect } from 'livekit-client'

const ViewerPage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<Room | null>(null)

    useEffect(() => {
        const connectToRoom = async () => {
            const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''
            const roomName = 'default-room'
            const identity = 'viewer-' + Math.floor(Math.random() * 10000)

            console.log('🔗 LiveKit URL:', serverUrl)

            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=subscriber`)
            const data = await res.json()
            const token = data.token as string

            console.log('🔑 Token:', typeof token, token)

            const room = await connect(serverUrl, token, {
                autoSubscribe: true,
            })
            setRoom(room)

            room.on('trackSubscribed', (track, publication, participant) => {
                if (track.kind === 'video' && videoRef.current) {
                    track.attach(videoRef.current)
                    console.log('🎥 Đã nhận video track từ:', participant.identity)
                }
            })

            room.on('disconnected', () => {
                setRoom(null)
                if (videoRef.current) {
                    videoRef.current.srcObject = null
                }
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
            <h1>👀 Viewer đang xem livestream</h1>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', maxWidth: 600, borderRadius: 12 }}
            />
        </div>
    )
}

export default ViewerPage
