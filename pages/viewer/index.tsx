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

    useEffect(() => {
        fetch('/api/active-rooms').then(r => r.json()).then(d => setRooms(d.rooms || []))
    }, [])

    useEffect(() => {
        if (!started || rooms.length === 0) return
            ; (async () => {
                const roomName = rooms[curIdx].room
                const identity = `viewer-${Date.now()}`
                console.log('Viewer requesting token for', roomName)
                const res = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=subscriber`)
                const { token } = await res.json()

                if (roomRef.current) {
                    await roomRef.current.disconnect()
                    roomRef.current = null
                    videoRef.current!.srcObject = null
                }

                const room = new Room()
                roomRef.current = room

                room.on('trackSubscribed', (track) => {
                    if (track.kind === 'video' && videoRef.current) track.attach(videoRef.current)
                    if (track.kind === 'audio') {
                        const el = track.attach()
                        const ctx = new AudioContext()
                        if (ctx.state === 'suspended') ctx.resume()
                        el.play().catch(console.warn)
                    }
                })

                await room.connect(LIVEKIT_URL, token)
                console.log('Viewer connected to', roomName)
            })()
    }, [started, curIdx, rooms])

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
        <div className="w-full h-full bg-black">
            {!started && (
                <button onClick={() => setStarted(true)}>▶️ Bắt đầu xem livestream</button>
            )}
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="overlay">{curr.sellerName}</div>
        </div>
    )
}
