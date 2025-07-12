'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Room } from 'livekit-client/dist/room'
import { RemoteTrack } from 'livekit-client/dist/track/RemoteTrack'
import { RoomEvent } from 'livekit-client/dist/events'

export const dynamic = 'force-dynamic'

export default function ViewerRoomPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const router = useRouter()
    const [roomName, setRoomName] = useState<string | null>(null)
    const [room, setRoom] = useState<Room | null>(null)

    useEffect(() => {
        if (!router.isReady) return
        const roomParam = router.query.room
        if (typeof roomParam === 'string') {
            setRoomName(roomParam)
        }
    }, [router.isReady, router.query.room])

    useEffect(() => {
        if (!roomName) return

        const connectLiveKit = async () => {
            try {
                console.log(`🚀 Đang kết nối vào phòng: ${roomName}`)

                const res = await fetch('/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        room: roomName,
                        identity: `viewer-${Math.floor(Math.random() * 10000)}`
                    })
                })

                const { token } = await res.json()
                if (!token) {
                    console.error('❌ Không lấy được token')
                    return
                }

                const newRoom = new Room()

                newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub, participant) => {
                    console.log(`📥 Nhận track ${track.kind} từ ${participant.identity}`)

                    if (track.kind === 'video' && videoRef.current) {
                        const el = track.attach()
                        el.style.width = '100%'
                        videoRef.current.replaceWith(el)
                        videoRef.current = el as HTMLVideoElement
                    }

                    if (track.kind === 'audio' && audioRef.current) {
                        const el = track.attach()
                        audioRef.current.srcObject = el.srcObject
                    }
                })

                await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
                console.log('✅ Viewer đã vào phòng:', roomName)

                setRoom(newRoom)
            } catch (err) {
                console.error('❌ Lỗi khi kết nối:', err)
            }
        }

        connectLiveKit()

        return () => {
            if (room) {
                console.log('⛔ Ngắt kết nối khỏi phòng:', roomName)
                room.disconnect()
            }
        }
    }, [roomName])

    return (
        <main className="p-6 max-w-xl mx-auto space-y-4">
            <h1 className="text-xl font-bold text-center">👁️ Người xem đang theo dõi phòng: {roomName}</h1>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded shadow" />
            <audio ref={audioRef} autoPlay />
        </main>
    )
}
