'use client'
import { useEffect, useState, useRef } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import debounce from 'lodash/debounce'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!

type RoomInfo = { room: string; sellerName: string; thumbnail: string }

export default function ViewerFeed() {
    const [rooms, setRooms] = useState<RoomInfo[]>([])
    const [curIdx, setCurIdx] = useState(0)
    const [started, setStarted] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const roomRef = useRef<Room | null>(null)

    useEffect(() => {
        fetch('/api/active-rooms')
            .then(async r => {
                if (!r.ok) {
                    const txt = await r.text()
                    console.error('❌ /api/active-rooms lỗi:', r.status, txt)
                    return
                }
                const d = await r.json()
                console.log('📥 rooms list:', d.rooms)
                setRooms(d.rooms || [])
            })
            .catch(err => console.error('❌ Request failed:', err))
    }, [])

    useEffect(() => {
        if (!started || rooms.length === 0) return
            ; (async () => {
                const roomName = rooms[curIdx].room
                const identity = `viewer-${Date.now()}`
                console.log('▶️ request token for', roomName)
                const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=subscriber`)
                if (!res.ok) {
                    const txt = await res.text()
                    console.error('❌ token error:', res.status, txt)
                    return
                }
                const { token } = await res.json()
                if (roomRef.current) {
                    roomRef.current.off(RoomEvent.TrackSubscribed)
                    await roomRef.current.disconnect()
                    roomRef.current = null
                    if (videoRef.current) videoRef.current.srcObject = null
                }
                const room = new Room({ autoSubscribe: true })
                roomRef.current = room
                room.on(RoomEvent.TrackSubscribed, track => {
                    if (track.kind === 'video' && videoRef.current) {
                        console.log('📹 video subscribed')
                        track.attach(videoRef.current)
                    }
                    if (track.kind === 'audio') {
                        console.log('🔊 audio subscribed')
                        const el = track.attach()
                        el.play().catch(() => {
                            console.warn('🔔 autoplay failed, calling room.startAudio()')
                            room.startAudio()
                        })
                    }
                })
                await room.connect(LIVEKIT_URL, token)
                console.log('✅ connected to', roomName)
            })()
    }, [started, curIdx, rooms])

    useEffect(() => {
        if (!started) return
        const h = debounce((e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurIdx(i => (i + 1) % rooms.length)
            if (e.key === 'ArrowLeft') setCurIdx(i => (i - 1 + rooms.length) % rooms.length)
        }, 100)
        window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [rooms, started])

    if (rooms.length === 0) return <p>⏳ Đang tải phòng livestream…</p>
    const curr = rooms[curIdx]
    return (
        <div className="w-full h-full bg-black relative">
            {!started && (
                <button onClick={() => setStarted(true)} className="absolute z-20 px-4 py-2 bg-blue-600 text-white rounded">
                    ▶️ Bắt đầu xem livestream
                </button>
            )}
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 text-white text-xl">{curr.sellerName}</div>
        </div>
    )
}
