'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Room, RemoteTrack, RoomEvent } from 'livekit-client';

export const dynamic = 'force-dynamic';

export default function ViewerRoomPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const router = useRouter();
    const [roomName, setRoomName] = useState<string | null>(null);
    const [room, setRoom] = useState<Room | null>(null);

    useEffect(() => {
        if (!router.isReady) return;
        const roomParam = router.query.room;
        if (typeof roomParam === 'string') {
            setRoomName(roomParam);
        }
    }, [router.isReady, router.query.room]);

    useEffect(() => {
        if (!roomName) return;

        const connectLiveKit = async () => {
            try {
                console.log(`🚀 Kết nối vào phòng: ${roomName}`);

                const res = await fetch('/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        room: roomName,
                        identity: `viewer-${Math.floor(Math.random() * 10000)}`,
                    }),
                });

                const { token } = await res.json();
                if (!token) {
                    console.error('❌ Token không hợp lệ');
                    return;
                }

                const newRoom = new Room();

                newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant) => {
                    console.log(`📥 Nhận track ${track.kind} từ ${participant.identity}`);

                    if (track.kind === 'video' && videoRef.current) {
                        track.attach(videoRef.current);
                    }
                    if (track.kind === 'audio' && audioRef.current) {
                        track.attach(audioRef.current);
                    }
                });

                await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
                console.log('✅ Viewer đã kết nối vào phòng:', roomName);

                setRoom(newRoom);
            } catch (err) {
                console.error('❌ Lỗi kết nối LiveKit:', err);
            }
        };

        connectLiveKit();

        return () => {
            if (room) {
                console.log('⛔ Ngắt kết nối phòng:', roomName);
                room.disconnect();
            }
        };
    }, [roomName]);

    return (
        <div style={{ padding: 40 }}>
            <h2>👁️ Viewer đang xem phòng: {roomName}</h2>
            <video ref={videoRef} autoPlay playsInline width="100%" />
            <audio ref={audioRef} autoPlay />
        </div>
    );
}
