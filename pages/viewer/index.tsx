'use client'

import { useEffect, useState, useRef } from 'react'
import { Room, RemoteTrackPublication, RemoteAudioTrack, RemoteVideoTrack, connect } from 'livekit-client'
import debounce from 'lodash/debounce'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL

type RoomInfo = {
    room: string
    sellerName: string
    thumbnail: string
}

export default function ViewerFeed() {
    const [rooms, setRooms] = useState<RoomInfo[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const videoRef = useRef<HTMLVideoElement>(null)
    const roomRef = useRef<Room | null>(null)

    // 🧲 Lấy danh sách phòng đang hoạt động
    useEffect(() => {
        fetch('/api/active-rooms')
            .then((res) => res.json())
            .then((data) => setRooms(data.rooms || []))
    }, [])

    // 🔁 Khi đổi room → join phòng mới
    useEffect(() => {
        if (rooms.length === 0) return

        const roomName = rooms[currentIndex].room
        const identity = `viewer-${Math.floor(Math.random() * 10000)}`

        const fetchTokenAndJoin = async () => {
            const res = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: roomName, identity }),
            })
            const { token } = await res.json()

            // Ngắt kết nối phòng cũ nếu có
            if (roomRef.current) {
                await roomRef.current.disconnect()
                roomRef.current = null
            }

            const room = new Room()
            roomRef.current = room

            room.on('trackSubscribed', (track, publication, participant) => {
                if (track.kind === 'video' && videoRef.current) {
                    track.attach(videoRef.current)
                }
                if (track.kind === 'audio') {
                    track.attach()
                }
            })

            await connect(room, LIVEKIT_URL!, token)
        }

        fetchTokenAndJoin()
    }, [currentIndex, rooms])

    // ⬅️➡️ Chuyển room bằng phím trái/phải
    const handleKey = debounce((e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
            setCurrentIndex((i) => (i + 1) % rooms.length)
        } else if (e.key === 'ArrowLeft') {
            setCurrentIndex((i) => (i - 1 + rooms.length) % rooms.length)
        }
    }, 100)

    useEffect(() => {
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [rooms])

    if (rooms.length === 0) {
        return <p className="text-center mt-10 text-gray-500">⏳ Đang tải danh sách phòng livestream...</p>
    }

    const currentRoom = rooms[currentIndex]

    return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 text-white text-xl font-bold">
                🎥 {currentRoom.sellerName}
            </div>
            <div className="absolute bottom-4 text-center w-full text-white">
                <p>⬅️ Dùng phím trái/phải để lướt giữa các phòng livestream</p>
                <p className="mt-1 text-sm text-gray-300">Đang xem: {currentRoom.room}</p>
            </div>
        </div>
    )
}
