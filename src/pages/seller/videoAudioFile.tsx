export const dynamic = 'force-dynamic';

import React, { useEffect, useRef, useState } from 'react';
const livekit = require('livekit-client');

export default function VideoAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const [videoURL, setVideoURL] = useState('');
    const [room, setRoom] = useState<any>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    const roomName = 'onlook-room';
    const identity = 'seller-merged-' + Math.floor(Math.random() * 10000);
    const role = 'publisher';

    const sampleVideos = [
        {
            name: 'Merged Video mẫu',
            url: 'https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/merged/merged.mp4',
        },
    ];

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoURL(url);
        }
    };

    const handleSampleSelect = (url: string) => {
        setVideoURL(url);
    };

    const startStream = async () => {
        if (!videoURL) {
            alert('Hãy chọn file video trước khi stream');
            return;
        }

        const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
        const data = await res.json();
        const token = data.token;

        const room = new livekit.Room();
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token);
        setRoom(room);

        const videoEl = videoRef.current!;
        videoEl.src = videoURL;
        videoEl.loop = true;
        videoEl.muted = true;
        await videoEl.play();

        const stream =
            (videoEl as any).captureStream?.() || (videoEl as any).mozCaptureStream?.();
        if (!stream) {
            console.warn('⚠️ Trình duyệt không hỗ trợ captureStream');
            return;
        }

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

        setIsStreaming(true);
    };

    const stopStream = async () => {
        if (room) {
            room.disconnect();
            setRoom(null);
        }

        setIsStreaming(false);

        await fetch('/api/stop-stream?userId=seller-merged');
        alert('⛔ Đã kết thúc stream. File sẽ được xoá sau 5 phút.');
    };

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold">Phát livestream từ merged.mp4</h1>

            <div className="space-y-2">
                <input type="file" accept="video/mp4" onChange={handleFileInput} />
                <div>
                    <label>Hoặc chọn video mẫu:</label>
                    <select onChange={(e) => handleSampleSelect(e.target.value)} className="ml-2">
                        <option value="">-- Chọn --</option>
                        {sampleVideos.map((v, i) => (
                            <option key={i} value={v.url}>{v.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <button
                onClick={isStreaming ? stopStream : startStream}
                className={`mt-4 px-4 py-2 rounded text-white ${isStreaming ? 'bg-red-600' : 'bg-green-600'}`}
            >
                {isStreaming ? '⛔ Kết thúc Stream' : '▶️ Bắt đầu Stream'}
            </button>

            <div className="mt-4">
                <div ref={videoContainerRef} />
                <video ref={videoRef} hidden />
            </div>
        </div>
    );
}
