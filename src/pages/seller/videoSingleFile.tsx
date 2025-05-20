import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

// ✅ Import đúng theo livekit-client@2.13.0
const { Room } = require('livekit-client/dist/room');
const { LocalVideoTrack, LocalAudioTrack } = require('livekit-client/dist/webrtc');

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

            // ✅ Khởi tạo room theo đúng chuẩn mới
            const room = new Room();
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
                autoSubscribe: true
            });
            setRoom(room);

            // 🎥 Tạo video element để phát file mp4 có sẵn
            const videoEl = document.createElement('video');
            videoEl.src = '/full-video.mp4'; // Đặt file trong thư mục public/
            videoEl.loop = true;
            videoEl.muted = true;
            await videoEl.play();

            const mediaStream = videoEl.captureStream();
            const videoTrack = mediaStream.getVideoTracks()[0];
            const audioTrack = mediaStream.getAudioTracks()[0];

            if (videoTrack) {
                const localVideoTrack = new LocalVideoTrack(videoTrack);
                await room.localParticipant.publishTrack(localVideoTrack);

                // Gắn preview cho seller
                const attached = localVideoTrack.attach();
                if (videoContainerRef.current) {
                    videoContainerRef.current.innerHTML = ''; // clear nếu có
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
