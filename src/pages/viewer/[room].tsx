export const dynamic = 'force-dynamic'; // Ngăn prerender gây lỗi khi dùng LiveKit trong trình duyệt

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { connectToRoom } from '@/services/LiveKitService';

const ViewerRoomPage: React.FC = () => {
    const router = useRouter();
    const { room: roomName } = router.query;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [room, setRoom] = useState<any>(null);

    useEffect(() => {
        if (!roomName || typeof roomName !== 'string') return;

        const identity = 'viewer-' + Math.floor(Math.random() * 100000);

        const start = async () => {
            const tokenRes = await fetch(
                `/api/token?room=${roomName}&identity=${identity}&role=subscriber`
            );
            const { token } = await tokenRes.json();

            const joinedRoom = await connectToRoom(
                process.env.NEXT_PUBLIC_LIVEKIT_URL!,
                token
            );
            setRoom(joinedRoom);

            joinedRoom.on('trackSubscribed', (track: any) => {
                if (track.kind === 'video' && videoRef.current) {
                    track.attach(videoRef.current);
                }
            });
        };

        start();

        return () => {
            room?.disconnect();
        };
    }, [roomName]);

    return (
        <div style={{ width: '100%', height: '100vh', background: 'black' }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
        </div>
    );
};

export default ViewerRoomPage;
