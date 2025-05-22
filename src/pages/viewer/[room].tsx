export const dynamic = 'force-dynamic'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
const livekit = require('livekit-client')

const ViewerRoomPage: React.FC = () => {
    const router = useRouter()
    const { room: roomName } = router.query

    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<any>(null)

    useEffect(() => {
        if (!roomName || typeof roomName !== 'string') return

        const identity = 'viewer-' + Math.floor(Math.random() * 100000)

        const start = async () => {
            const tokenRes = await fetch(
                `/api/token?room=${roomName}&identity=${identity}&role=subscriber`
            )
            const { token } = await tokenRes.json()

            const room = new livekit.Room()
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token)
            setRoom(room)

            room.on('trackSubscribed', (track: any) => {
                if (track.kind === 'video' && videoRef.current) {
                    track.attach(videoRef.current)
                }
                if (track.kind === 'audio') {
                    const audioEl = track.attach() as HTMLAudioElement
                    audioEl.autoplay = true
                    audioEl.play().catch(() => {
                        console.warn('👂 User gesture required to play audio.')
                    })
                    document.body.appendChild(audioEl)
                }
            })
        }

        start()

        return () => {
            room?.disconnect()
        }
    }, [roomName])

    return (
        <div style={{ width: '100%', height: '100vh', background: 'black' }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
        </div>
    )
}

export default ViewerRoomPage
