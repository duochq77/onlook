export const dynamic = 'force-dynamic';

import React, { useEffect, useRef, useState } from 'react';
const livekit = require('livekit-client');

export default function VideoAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [mergedURL, setMergedURL] = useState<string | null>(null);

    const [room, setRoom] = useState<any>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    const roomName = 'onlook-room';
    const identity = 'seller-merged-' + Math.floor(Math.random() * 10000);
    const role = 'publisher';

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            alert('❗ Cần chọn đủ cả video.mp4 và audio.mp3');
            return;
        }

        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('audio', audioFile);

        const res = await fetch('/api/merge-upload', {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();
        if (data.url) {
            setMergedURL(data.url);
            alert('✅ Đã xử lý xong merged.mp4');
        } else {
            alert('❌ Xử lý thất bại');
        }
    };

    const startStream = async () => {
        if (!mergedURL) return;

        const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`);
        const data = await res.json();
        const token = data.token;

        const room = new livekit.Room();
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token);
        setRoom(room);

        const videoEl = videoRef.current!;
        videoEl.src = mergedURL;
        videoEl.loop = true;
        videoEl.muted = true;
        await videoEl.play();

        const stream = (videoEl as any).captureStream?.() || (videoEl as any).mozCaptureStream?.();
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

        setIsStreaming(true);
    };

    const stopStream = async () => {
        if (room) {
            room.disconnect();
            setRoom(null);
        }

        setIsStreaming(false);
        await fetch('/api/stop-stream?userId=seller-merged');
        alert('⛔ Đã kết thúc stream. File sẽ xoá sau 5 phút.');
    };

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold">📦 Phát livestream từ merged.mp4</h1>

            <div className="space-y-2">
                <div>
                    <label className="block font-medium">🎞️ Chọn video gốc (.mp4)</label>
                    <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                </div>
                <div>
                    <label className="block font-medium">🔊 Chọn audio (.mp3)</label>
                    <input type="file" accept="audio/mp3" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                </div>
                <button
                    className="px-4 py-2 rounded bg-yellow-500 text-white"
                    onClick={handleUpload}
                    disabled={!videoFile || !audioFile}
                >
                    ⚙️ Tạo merged.mp4
                </button>
            </div>

            {mergedURL && (
                <button
                    onClick={isStreaming ? stopStream : startStream}
                    className={`mt-4 px-4 py-2 rounded text-white ${isStreaming ? 'bg-red-600' : 'bg-green-600'}`}
                >
                    {isStreaming ? '⛔ Kết thúc Stream' : '▶️ Bắt đầu Stream'}
                </button>
            )}

            <div className="mt-4">
                <div ref={videoContainerRef} />
                <video ref={videoRef} hidden />
            </div>
        </div>
    );
}
