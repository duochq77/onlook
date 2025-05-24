'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

export const dynamic = 'force-dynamic'

export default function ViewerRoomPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const router = useRouter()
    const { room: roomName } = router.query

    useEffect(() => {
        if (!roomName || typeof roomName !== 'string') return

        const connectLiveKit = async () => {
            const res = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room: roomName,
                    identity: 'viewer-' + Math.floor(Math.random() * 10000)
                })
            })

            const { token } = await res.json()
            if (!token) return console.error('❌ Token không hợp lệ')

            const { Room } = require('livekit-client')
            const room = new Room()

            room.on('trackSubscribed', (track: any) => {
                if (track.kind === 'video' && videoRef.current) {
                    track.attach(videoRef.current)
                }
                if (track.kind === 'audio' && audioRef.current) {
                    track.attach(audioRef.current)
                }
            })

            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            console.log('✅ Connected to room:', roomName)
        }

        connectLiveKit()
    }, [roomName])

    return (
        <div style={{ padding: 40 }}>
            <h2>👁️ Viewer đang xem phòng: {roomName}</h2>
            <video ref={videoRef} autoPlay playsInline width="100%" />
            <audio ref={audioRef} autoPlay />
        </div>
    )
}
