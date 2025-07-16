'use client';
import React, { useRef, useState } from 'react';
import { Room } from 'livekit-client';

export default function VideoSingleFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [streaming, setStreaming] = useState(false);
    const [ingressId, setIngressId] = useState<string | null>(null);
    const [uploadedKey, setUploadedKey] = useState<string | null>(null);
    const roomRef = useRef<Room | null>(null);

    async function handleStart() {
        if (!file) return alert('Bạn chưa chọn file MP4!');
        setStreaming(true);

        // Upload
        const fd = new FormData();
        fd.append('file', file);
        const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
            method: 'POST', body: fd
        });
        const ud = await up.json();
        setUploadedKey(ud.key);

        const roomName = `room-${Date.now()}`;
        const tokenRes = await fetch(`/api/token?room=${roomName}&identity=${roomName}&role=publisher`);
        const { token } = await tokenRes.json();

        const room = new Room();
        roomRef.current = room;
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);

        // Tạo ingress
        const ingressRes = await fetch('http://localhost:4001/ingress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, key: ud.key }),
        }).then(r => r.json());
        setIngressId(ingressRes.ingressId);

        // Hiển thị preview video (mute)
        const vid = videoRef.current!;
        vid.src = `https://pub-${process.env.NEXT_PUBLIC_R2_ACCOUNT_ID}.r2.dev/${ud.key}`;
        vid.muted = true;
        vid.play().catch(console.warn);
    }

    async function handleStop() {
        if (ingressId || uploadedKey) {
            await fetch('http://localhost:4002/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingressId, key: uploadedKey }),
            });
        }
        if (roomRef.current) {
            await roomRef.current.disconnect();
            roomRef.current = null;
        }
        setStreaming(false);

        const vid = videoRef.current;
        if (vid) {
            vid.pause();
            vid.src = '';
        }
    }

    return (
        <main>
            <h1>📁 Livestream MP4 (Video + Audio)</h1>
            <input
                type="file"
                accept="video/mp4"
                disabled={streaming}
                onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <button onClick={handleStart} disabled={!file || streaming}>▶️ Bắt đầu</button>
            <button onClick={handleStop} disabled={!streaming}>⏹️ Dừng</button>
            <video ref={videoRef} width="640" height="360" playsInline style={{ background: '#000' }} />
        </main>
    );
}
