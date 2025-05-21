export const dynamic = 'force-dynamic'; // Ngăn lỗi khi dùng Audio/Video trên SSR

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
const livekit = require('livekit-client');

const SellerVideoSingleFilePage: React.FC = () => {
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState<any>(null);
    const router = useRouter();

    const roomName = 'onlook-room';
    const identity = 'seller-' + Math.floor(Math.random() * 10000);
    const role = 'publisher';

    useEffect(() => {
        const startLivestream = async () => {
            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
            const { token } = await res.json();

            const room = new livekit.Room();
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
                autoSubscribe: true,
            });
            setRoom(room);

            const videoEl = document.createElement('video');
            videoEl.src = '/full-video.mp4';
            videoEl.loop = true;
            videoEl.muted = true;
            await videoEl.play();

            const stream =
                (videoEl as any).captureStream?.() ||
                (videoEl as any).mozCaptureStream?.();

            if (!stream) return;

            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];

            if (videoTrack) {
                const localVideoTrack = new livekit.LocalVideoTrack(videoTrack);
                await room.localParticipant.publishTrack(localVideoTrack);
                const attached = localVideoTrack.attach();
                if (videoContainerRef.current) {
                    videoContainerRef.current.innerHTML = '';
                    videoContainerRef.current.appendChild(attached);
                }
            }

            if (audioTrack) {
                const localAudioTrack = new livekit.LocalAudioTrack(audioTrack);
                await room.localParticipant.publishTrack(localAudioTrack);
            }
        };

        startLivestream();
        return () => {
            room?.disconnect();
        };
    }, []);

    return (
        <div>
            <h2>🔴 Livestream: Phát file video có sẵn (có cả âm thanh)</h2>
            <div ref={videoContainerRef} />
        </div>
    );
};

export default SellerVideoSingleFilePage;
