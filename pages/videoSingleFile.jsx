'use client';
import React, { useRef, useState } from 'react';
import { supabase } from '@/services/SupabaseService';
export default function VideoSingleFilePage() {
    const videoRef = useRef(null);
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const handleUpload = async () => {
        if (!videoFile)
            return;
        const timestamp = Date.now();
        const path = `outputs/${timestamp}-single.mp4`;
        const { error } = await supabase.storage.from('stream-files').upload(path, videoFile, { upsert: true });
        if (error) {
            alert('❌ Upload video thất bại: ' + error.message);
            return;
        }
        const { data } = supabase.storage.from('stream-files').getPublicUrl(path);
        setVideoUrl(data.publicUrl);
    };
    const toggleStream = async () => {
        if (!videoUrl)
            return;
        if (!isStreaming) {
            alert('▶️ Bắt đầu livestream');
            setIsStreaming(true);
            videoRef.current?.play();
        }
        else {
            const fileName = `outputs/${videoUrl.split('/').pop()}`;
            await fetch('/api/stop-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName })
            });
            alert('⛔ Đã kết thúc livestream');
            setIsStreaming(false);
            videoRef.current?.pause();
        }
    };
    return (<div className="p-8">
            <h1 className="text-2xl font-bold mb-4">📤 Livestream video đã hoàn chỉnh</h1>

            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} className="mb-4"/>

            <button onClick={handleUpload} disabled={!videoFile} className="bg-blue-600 text-white px-4 py-2 rounded mb-6">
                ⬆️ Upload video
            </button>

            {videoUrl && (<>
                    <video ref={videoRef} src={videoUrl} controls className="w-full max-w-xl mb-4"/>
                    <button onClick={toggleStream} className={`px-4 py-2 rounded text-white ${isStreaming ? 'bg-red-600' : 'bg-green-600'}`}>
                        {isStreaming ? '⛔ Kết thúc livestream' : '▶️ Bắt đầu livestream'}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                        ⚠️ File sẽ tự động xoá sau 10 phút kể từ khi kết thúc livestream.
                    </p>
                </>)}
        </div>);
}
