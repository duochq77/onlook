import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

const { Room } = require('livekit-client/dist/room');
const {
    LocalVideoTrack,
    LocalAudioTrack,
    createLocalVideoTrack,
    createLocalAudioTrack,
} = require('livekit-client/dist/webrtc');

const SellerWebcamMicPage: React.FC = () => {
    const videoRef = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState<any>(null);
    const router = useRouter();

    const roomName = 'onlook-room';
    const identity = 'seller-webcam-mic-' + Math.floor(Math.random() * 10000);
    const role = 'publisher';

    useEffect(() => {
        const startLivestream = async () => {
            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
            const { token } = await res.json();

            const room = new Room();
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
                autoSubscribe: true,
            });
            setRoom(room);

            const videoTrack = await createLocalVideoTrack();
            const audioTrack = await createLocalAudioTrack();

            await room.localParticipant.publishTrack(videoTrack);
            await room.localParticipant.publishTrack(audioTrack);

            const attached = videoTrack.attach();
            if (videoRef.current) {
                videoRef.current.innerHTML = '';
                videoRef.current.appendChild(attached);
            }
        };

        startLivestream();
        return () => {
            room?.disconnect();
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h2 className="text-2xl font-bold mb-4">🎥 Livestream webcam + mic</h2>
            <div ref={videoRef} />
        </div>
    );
};

export default SellerWebcamMicPage;
