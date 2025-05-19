import React, { useEffect, useRef, useState } from 'react';
import { connect, Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client';

const SellerVideoSingleFilePage: React.FC = () => {
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState<Room | null>(null);

    useEffect(() => {
        async function startLivestream() {
            const roomName = 'onlook-room';
            const identity = 'seller-' + Math.floor(Math.random() * 10000);
            const role = 'publisher';

            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
            const data = await res.json();
            const token = data.token;

            const room = await connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
            setRoom(room);

            const videoEl = document.createElement('video');
            videoEl.src = '/full-video.mp4'; // Đặt file trong thư mục public
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
        }

        startLivestream();

        return () => {
            room?.disconnect();
        };
    }, []);

    return (
        <div>
            <h2>📽️ Livestream: Phát file video có sẵn (full-video.mp4)</h2>
            <div ref={videoContainerRef} />
        </div>
    );
};

export default SellerVideoSingleFilePage;
