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

        try {
            // ✅ Upload file lên Cloud Run worker
            const fd = new FormData();
            fd.append('file', file);
            const up = await fetch('https://upload-audio-worker-729288097042.asia-southeast1.run.app/upload', {
                method: 'POST',
                body: fd
            });
            const ud = await up.json();
            const { key } = ud;
            setUploadedKey(key);

            // ✅ Tạo token từ API nội bộ `/api/token`
            const roomName = `room-${Date.now()}`;
            const tokenRes = await fetch(`/api/token?room=${roomName}&identity=${roomName}&role=publisher`);
            const { token } = await tokenRes.json();

            const room = new Room();
            roomRef.current = room;
            await room.connect('wss://onlook-jvtj33oo.livekit.cloud', token);

            // ✅ Gọi worker `ingress` trên GKE qua IP thật
            const ingressRes = await fetch('http://35.198.242.28/ingress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName, key }),
            }).then(r => r.json());
            setIngressId(ingressRes.ingressId);

            // ✅ Hiển thị video preview từ R2
            const vid = videoRef.current!;
            vid.src = `https://pub-97130163a49f578e8cd93a8adc5c5994.r2.dev/${key}`;
            vid.muted = true;
            vid.play().catch(console.warn);
        } catch (err) {
            console.error('Lỗi khi bắt đầu livestream:', err);
            alert('Không thể khởi động livestream. Vui lòng thử lại.');
            setStreaming(false);
        }
    }

    async function handleStop() {
        try {
            // ✅ Gọi worker `stop` qua IP thật
            if (ingressId || uploadedKey) {
                await fetch('http://34.143.208.97/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ingressId, key: uploadedKey }),
                });
            }
            if (roomRef.current) {
                await roomRef.current.disconnect();
                roomRef.current = null;
            }
        } catch (err) {
            console.warn('Lỗi khi dừng stream:', err);
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
