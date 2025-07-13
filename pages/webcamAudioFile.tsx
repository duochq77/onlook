// file: ViewerFeed.tsx (thay cho pages/viewer/index.tsx)
'use client'

import { useEffect, useState, useRef } from 'react'
import { Room } from 'livekit-client'
import debounce from 'lodash/debounce'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!

type RoomInfo = { room: string, sellerName: string, thumbnail: string }

export default function ViewerFeed() {
    const [rooms, setRooms] = useState<RoomInfo[]>([])
    const [curIdx, setCurIdx] = useState(0)
    const [started, setStarted] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const roomRef = useRef<Room | null>(null)
    const audioCtx = useRef<AudioContext | null>(null)

    // Load danh sách phòng livestream
    useEffect(() => {
        fetch('/api/active-rooms')
            .then(r => {
                if (!r.ok) throw new Error(`Status ${r.status}`)
                return r.json()
            })
            .then(d => {
                setRooms(d.rooms || [])
                console.log('✅ Active rooms loaded:', d.rooms)
            })
            .catch(e => console.error('❌ fetch active-rooms failed', e))
    }, [])

    // Kết nối/view khi bắt đầu hoặc chuyển phòng
    useEffect(() => {
        if (!started || rooms.length === 0) return

            ; (async () => {
                console.log('🔄 Connecting viewer to room', rooms[curIdx].room)
                const roomName = rooms[curIdx].room
                const identity = `viewer-${Date.now()}`

                // Cleanup trước khi connect mới
                if (roomRef.current) {
                    console.log('🔌 Disconnecting old room...')
                    roomRef.current.off('trackSubscribed')
                    await roomRef.current.disconnect()
                    roomRef.current = null
                }
                if (videoRef.current) {
                    console.log('🗑 Clearing old video srcObject')
                    videoRef.current.srcObject = null
                }

                // Khởi tạo AudioContext nếu chưa có
                if (!audioCtx.current) {
                    audioCtx.current = new AudioContext()
                    console.log('🎧 AudioContext created')
                }

                // Gọi lấy token
                const res = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=subscriber`)
                if (!res.ok) {
                    console.error('❌ Token request failed', await res.text())
                    return
                }
                const { token } = await res.json()

                const room = new Room()
                roomRef.current = room

                room.on('trackSubscribed', track => {
                    if (track.kind === 'video' && videoRef.current) {
                        console.log('📹 Video track subscribed')
                        track.attach(videoRef.current)
                    }
                    if (track.kind === 'audio') {
                        console.log('🔊 Audio track subscribed')
                        const el = track.attach()
                        const ctx = audioCtx.current!
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

    // Điều hướng qua trái phải
    useEffect(() => {
        if (!started) return
        const onKey = debounce((e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurIdx(i => (i + 1) % rooms.length)
            if (e.key === 'ArrowLeft') setCurIdx(i => (i - 1 + rooms.length) % rooms.length)
        }, 100)
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [rooms, started])

    if (rooms.length === 0) return <p>⏳ Loading active rooms...</p>

    const curr = rooms[curIdx]

    return (
        <div className="w-full h-full bg-black relative">
            {!started && (
                <button
                    onClick={() => setStarted(true)}
                    className="absolute z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-3 rounded"
                >
                    ▶️ Bắt đầu xem livestream
                </button>
            )}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover bg-black"
            />
            <div className="absolute top-4 left-4 text-white text-xl font-bold">
                🎥 {curr.sellerName}
            </div>
        </div>
    )
}
