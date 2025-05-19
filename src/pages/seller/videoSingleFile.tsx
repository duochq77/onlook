// src/pages/seller/videoSingleFile.tsx
import React, { useEffect, useRef, useState } from 'react';
import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { connect } from 'livekit-client/dist/es5/connect'; // ✅ dùng đúng cách
import { Room } from 'livekit-client';

const SellerVideoSingleFilePage: React.FC = () => {
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState<Room | null>(null);

    useEffect(() => {
        async function start() {
            const roomName = 'onlook-room';
            const identity = 'seller-' + Math.floor(Math.random() * 10000);
            const role = 'publisher';

            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
            const data = await res.json();
            const token = data.token;

            const room = await connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
            setRoom(room);

            const videoEl = document.createElement('video');
            videoEl.src = '/full-video.mp4';
            videoEl.loop = true;
            videoEl.muted = true;
            await videoEl.play();

            const stream = videoEl.captureStream();
            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];

            if (videoTrack) {
                const localVideo = new LocalVideoTrack(videoTrack);
                await room.localParticipant.publishTrack(localVideo);
                const el = localVideo.attach();
                if (videoContainerRef.current) {
                    videoContainerRef.current.appendChild(el);
                }
            }

            if (audioTrack) {
                const localAudio = new LocalAudioTrack(audioTrack);
                await room.localParticipant.publishTrack(localAudio);
            }
        }

        start();
        return () => {
            room?.disconnect();
        };
    }, []);

    return (
        <div>
            <h2>Livestream từ video có sẵn</h2>
            <div ref={videoContainerRef}></div>
        </div>
    );
};

export default SellerVideoSingleFilePage;
