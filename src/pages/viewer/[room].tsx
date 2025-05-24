// src/pages/viewer/[room].tsx

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Room } from 'livekit-client/dist/room'
import { Participant, RemoteTrackPublication, Track } from 'livekit-client'

export const dynamic = 'force-dynamic' // tránh bị prerender

export default function ViewerRoomPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const roomRef = useRef<Room | null>(null)
    const router = useRouter()

    const { room: roomName } = router.query
    const identity = 'viewer-' + Math.floor(Math.random() * 10000)

    useEffect(() => {
        if (!roomName || typeof roomName !== 'string') return

        const connectLiveKit = async () => {
            const res = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: roomName, identity })
            })

            const { token } = await res.json()
            if (!token) return console.error('❌ Token không hợp lệ')

            const { Room } = require('livekit-client/dist/room')
            const { connect } = require('livekit-client/dist/connect')

            const room: Room = new Room()
            roomRef.current = room

            room.on('trackSubscribed', (track, pub, participant) => {
                console.log('🔗 Track subscribed:', track.kind)
                if (track.kind === Track.Kind.Video && videoRef.current) {
                    track.attach(videoRef.current)
                }
                if (track.kind === Track.Kind.Audio && audioRef.current) {
                    track.attach(audioRef.current)
                }
            })

            await connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
                room,
                autoSubscribe: true
            })

            console.log('✅ Viewer connected to room:', roomName)
        }

        connectLiveKit()

        return () => {
            if (roomRef.current) {
                roomRef.current.disconnect()
            }
        }
    }, [roomName])

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
            <h2>👁️ Viewer đang xem phòng: {roomName}</h2>

            <video ref={videoRef} autoPlay playsInline width="100%" />
            <audio ref={audioRef} autoPlay />

            <p style={{ marginTop: 20 }}>🎥 Đang phát livestream...</p>
        </div>
    )
}
