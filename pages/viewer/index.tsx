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

    // 1️⃣ Load danh sách phòng
    useEffect(() => {
        fetch('/api/active-rooms')
            .then(async r => {
                if (!r.ok) {
                    const t = await r.text()
                    console.error('❌ active-rooms API lỗi:', r.status, t)
                    return
                }
                const d = await r.json()
                console.log('📥 Load rooms:', d.rooms)
                setRooms(d.rooms ?? [])
            })
            .catch(e => console.error('❌ fetch active-rooms failed:', e))
    }, [])

    // 2️⃣ Khi bắt đầu xem hoặc chuyển phòng
    useEffect(() => {
        if (!started || rooms.length === 0) return
            ; (async () => {
                const { room: roomName } = rooms[curIdx]
                console.log('▶️ Viewer chuẩn bị kết nối tới:', roomName)

                const res = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=viewer-${Date.now()}&role=subscriber`)
                if (!res.ok) {
                    const t = await res.text()
                    return console.error('❌ Lỗi token:', res.status, t)
                }
                const { token } = await res.json()

                if (roomRef.current) {
                    console.log('🔌 Disconnect phòng cũ')
                    roomRef.current.off(RoomEvent.TrackSubscribed)
                    await roomRef.current.disconnect()
                    roomRef.current = null
                    if (videoRef.current) videoRef.current.srcObject = null
                }

                const room = new Room({ autoSubscribe: true })
                roomRef.current = room

                room.on(RoomEvent.TrackSubscribed, track => {
                    if (track.kind === 'video' && videoRef.current) {
                        console.log('📹 Video track subscribed')
                        track.attach(videoRef.current)
                    }
                    if (track.kind === 'audio') {
                        console.log('🔊 Audio track subscribed')
                        const el = track.attach()
                        el.play().catch(() => {
                            console.warn('Audio autoplay bị chặn, thử startAudio()')
                            room.startAudio()
                        })
                    }
                })

                await room.connect(LIVEKIT_URL, token)
                console.log('✅ Viewer đã vào room', roomName)
            })()
    }, [started, curIdx, rooms])

    // 3️⃣ Điều khiển trái/phải
    useEffect(() => {
        if (!started) return
        const onKey = debounce((e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurIdx(i => (i + 1) % rooms.length)
            if (e.key === 'ArrowLeft') setCurIdx(i => (i - 1 + rooms.length) % rooms.length)
        }, 100)
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [rooms, started])

    if (rooms.length === 0) return <p>⏳ Đang tải phòng livestream...</p>
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
