export const dynamic = 'force-dynamic'; // Ngăn lỗi SSR vì dùng camera/mic
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
const livekit = require('livekit-client');
const SellerWebcamMicPage = () => {
    const videoRef = useRef(null);
    const [room, setRoom] = useState(null);
    const router = useRouter();
    const roomName = 'onlook-room';
    const identity = 'seller-webcam-mic-' + Math.floor(Math.random() * 10000);
    const role = 'publisher';
    useEffect(() => {
        const startLivestream = async () => {
            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
            const { token } = await res.json();
            const room = new livekit.Room();
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token);
            setRoom(room);
            const videoTrack = await livekit.createLocalVideoTrack();
            const audioTrack = await livekit.createLocalAudioTrack();
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
    return (<div className="flex flex-col items-center justify-center min-h-screen">
            <h2 className="text-2xl font-bold mb-4">🎥 Livestream webcam + mic</h2>
            <div ref={videoRef}/>
        </div>);
};
export default SellerWebcamMicPage;
