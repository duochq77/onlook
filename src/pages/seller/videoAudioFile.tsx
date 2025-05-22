export const dynamic = 'force-dynamic';

import React, { useEffect, useRef, useState } from 'react';
const livekit = require('livekit-client');

export default function VideoAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const [useSample, setUseSample] = useState(false);
    const [videoURL, setVideoURL] = useState('');
    const [audioURL, setAudioURL] = useState('');
    const [room, setRoom] = useState<any>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    const identity = 'seller-video-audio-' + Math.floor(Math.random() * 100000);
    const roomName = 'onlook-room';
    const role = 'publisher';

    const sampleVideos = [
        {
            name: 'Video mẫu 1',
            url: 'https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/sample-videos/sample1.mp4',
        },
    ];

    const sampleAudios = [
        {
            name: 'Audio mẫu 1',
            url: 'https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/sample-audios/sample1.mp3',
        },
    ];

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio') => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (type === 'video') setVideoURL(url);
            else setAudioURL(url);
        }
    };

    const handleSampleSelect = (type: 'video' | 'audio', url: string) => {
        if (type === 'video') setVideoURL(url);
        else setAudioURL(url);
    };

    const startStream = async () => {
        if (!videoURL || !audioURL) {
            alert('Hãy chọn đầy đủ video và audio trước khi stream');
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

        const audioEl = audioRef.current!;
        audioEl.src = audioURL;
        audioEl.loop = true;
        await audioEl.play();

        const videoStream = videoEl.captureStream?.() || (videoEl as any).mozCaptureStream?.();
        const audioStream = audioEl.captureStream?.() || (audioEl as any).mozCaptureStream?.();

        if (!videoStream || !audioStream) return;

        const videoTrack = videoStream.getVideoTracks()[0];
        const audioTrack = audioStream.getAudioTracks()[0];

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

        // ✅ Gửi tín hiệu kết thúc livestream đúng userId
        await fetch(`/api/stop-stream?userId=${identity}`);
        alert('Đã kết thúc stream. Hệ thống sẽ xoá file sau 5 phút.');
    };

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold">Phương thức 3: Livestream từ video sạch và audio riêng</h1>

            <div className="flex gap-4">
                <button
                    className={`px-4 py-2 rounded ${!useSample ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => setUseSample(false)}
                >
                    Chọn từ thiết bị
                </button>
                <button
                    className={`px-4 py-2 rounded ${useSample ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => setUseSample(true)}
                >
                    Dùng mẫu có sẵn
                </button>
            </div>

            {!useSample ? (
                <div className="space-y-2">
                    <input type="file" accept="video/mp4" onChange={(e) => handleFileInput(e, 'video')} />
                    <input type="file" accept="audio/mp3" onChange={(e) => handleFileInput(e, 'audio')} />
                </div>
            ) : (
                <div className="space-y-2">
                    <div>
                        <label>Video mẫu:</label>
                        <select onChange={(e) => handleSampleSelect('video', e.target.value)} className="ml-2">
                            <option value="">-- Chọn --</option>
                            {sampleVideos.map((v, i) => (
                                <option key={i} value={v.url}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>Audio mẫu:</label>
                        <select onChange={(e) => handleSampleSelect('audio', e.target.value)} className="ml-2">
                            <option value="">-- Chọn --</option>
                            {sampleAudios.map((a, i) => (
                                <option key={i} value={a.url}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <button
                onClick={isStreaming ? stopStream : startStream}
                className={`mt-4 px-4 py-2 rounded text-white ${isStreaming ? 'bg-red-600' : 'bg-green-600'}`}
            >
                {isStreaming ? '⛔ Kết thúc Stream' : '▶️ Bắt đầu Stream'}
            </button>

            <div className="mt-4">
                <div ref={videoContainerRef} />
                <video ref={videoRef} hidden />
                <audio ref={audioRef} hidden />
            </div>
        </div>
    );
}
