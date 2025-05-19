// src/pages/seller/videoSingleFile.tsx
import React, { useEffect, useRef, useState } from 'react';
import { connect, LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { useRouter } from 'next/router';

const SellerVideoSingleFilePage: React.FC = () => {
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState<any>(null); // Room object
    const router = useRouter();

    const roomName = 'onlook-room';
    const identity = 'seller-' + Math.floor(Math.random() * 10000);
    const role = 'publisher';

    useEffect(() => {
        const startLivestream = async () => {
            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
            const { token } = await res.json();

            // Connect to room using connect()
            const room = await connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
            setRoom(room);

            const videoEl = document.createElement('video');
            videoEl.src = '/full-video.mp4'; // file public
            videoEl.loop = true;
            videoEl.muted = true;
            await videoEl.play();

            const mediaStream = videoEl.captureStream();
            const videoTrack = mediaStream.getVideoTracks()[0];
            const audioTrack = mediaStream.getAudioTracks()[0];

            if (videoTrack) {
                const localVideoTrack = new LocalVideoTrack(videoTrack);
                await room.localParticipant.publishTrack(localVideoTrack);

                const attached = localVideoTrack.attach();
                if (videoContainerRef.current) {
                    videoContainerRef.current.appendChild(attached);
                }
            }

            if (audioTrack) {
                const localAudioTrack = new LocalAudioTrack(audioTrack);
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
