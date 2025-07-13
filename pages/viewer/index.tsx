// pages/viewer/index.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { Room } from 'livekit-client'
import debounce from 'lodash/debounce'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!

type RoomInfo = {
    room: string
    sellerName: string
    thumbnail: string
}

export default function ViewerFeed() {
    const [rooms, setRooms] = useState<RoomInfo[]>([])
    const [curIdx, setCurIdx] = useState(0)
    const [started, setStarted] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const roomRef = useRef<Room | null>(null)

    // Lấy danh sách phòng active
    useEffect(() => {
        fetch('/api/active-rooms')
            .then(async res => {
                if (!res.ok) {
                    const txt = await res.text()
                    console.error('❌ active-rooms API lỗi:', res.status, txt)
                    return
                }
                const d = await res.json()
                setRooms(d.rooms || [])
            })
            .catch(err => console.error('❌ Request /active-rooms thất bại:', err))
    }, [])

    // Khi viewer bắt đầu hoặc chuyển phòng
    useEffect(() => {
        if (!started || rooms.length === 0) return

            ; (async () => {
                const roomName = rooms[curIdx].room
                const identity = `viewer-${Date.now()}`
                console.log('▶️ Viewer request token for', roomName)

                const res = await fetch(
                    `/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=subscriber`
                )
                if (!res.ok) {
                    const txt = await res.text()
                    console.error('❌ Lỗi token:', res.status, txt)
                    return
                }
                const { token } = await res.json()

                if (roomRef.current) {
                    await roomRef.current.disconnect()
                    roomRef.current = null
                    if (videoRef.current) videoRef.current.srcObject = null
                }

                const room = new Room()
                roomRef.current = room

                room.on('trackSubscribed', track => {
                    if (track.kind === 'video' && videoRef.current) {
                        track.attach(videoRef.current)
                    }
                    if (track.kind === 'audio') {
                        const el = track.attach()
                        const ctx = new AudioContext()
                        if (ctx.state === 'suspended') {
                            ctx.resume().then(() => console.log('✅ AudioContext resumed'))
                        }
                        el.play().catch(console.warn)
                    }
                })

                await room.connect(LIVEKIT_URL, token)
                console.log('✅ Viewer connected to', roomName)
            })()
    }, [started, curIdx, rooms])

    // Key navigation
    useEffect(() => {
        if (!started) return
        const handler = debounce((e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurIdx(i => (i + 1) % rooms.length)
            if (e.key === 'ArrowLeft') setCurIdx(i => (i - 1 + rooms.length) % rooms.length)
        }, 100)
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [rooms, started])

    if (rooms.length === 0) {
        return <p>⏳ Đang tải phòng livestream...</p>
    }

    const curr = rooms[curIdx]
    return (
        <div className="w-full h-full bg-black relative">
            {!started && (
                <button
                    onClick={() => setStarted(true)}
                    className="absolute z-20 px-4 py-2 bg-blue-600 text-white rounded"
                >
                    ▶️ Bắt đầu xem livestream
                </button>
            )}
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 text-white text-xl">{curr.sellerName}</div>
        </div>
    )
}
