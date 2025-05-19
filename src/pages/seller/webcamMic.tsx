import React, { useEffect, useRef, useState } from 'react';
import { connect, Room, LocalVideoTrack, LocalAudioTrack, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { useRouter } from 'next/router';

const SellerWebcamMicPage: React.FC = () => {
    const videoRef = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const router = useRouter();

    const roomName = 'onlook-room';
    const identity = 'seller-' + Math.floor(Math.random() * 10000);
    const role = 'publisher';

    useEffect(() => {
        const startLivestream = async () => {
            const resp = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
            const { token } = await resp.json();

            const room = await connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
                autoSubscribe: false,
            });

            setRoom(room);

            const videoTrack = await createLocalVideoTrack();
            const audioTrack = await createLocalAudioTrack();

            await room.localParticipant.publishTrack(videoTrack);
            await room.localParticipant.publishTrack(audioTrack);

            const element = videoTrack.attach();
            if (videoRef.current) {
                videoRef.current.appendChild(element);
            }
        };

        startLivestream();

        return () => {
            room?.disconnect();
        };
    }, []);

    return (
        <div>
            <h2>🔴 Livestream: Webcam + Mic</h2>
            <div ref={videoRef} />
        </div>
    );
};

export default SellerWebcamMicPage;
