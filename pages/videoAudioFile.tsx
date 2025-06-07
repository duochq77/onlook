'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { supabase } from '@/services/SupabaseService';

export default function VideoAudioFilePage() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [mergedUrl, setMergedUrl] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [outputName, setOutputName] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio') => {
        const file = e.target.files?.[0] || null;
        if (type === 'video') setVideoFile(file);
        else setAudioFile(file);
    };

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            return alert('❌ Vui lòng chọn đầy đủ video và audio!');
        }

        setIsProcessing(true);

        const timestamp = Date.now();
        const videoPath = `input-videos/${timestamp}-video.mp4`;
        const audioPath = `input-audios/${timestamp}-audio.mp3`;
        const mergedOutput = `${timestamp}-merged.mp4`;
        const outputPath = `outputs/${mergedOutput}`;
        setOutputName(mergedOutput);

        try {
            console.log('📤 Đang upload video:', videoPath);
            await supabase.storage.from('stream-files').upload(videoPath, videoFile, { upsert: true });

            console.log('📤 Đang upload audio:', audioPath);
            await supabase.storage.from('stream-files').upload(audioPath, audioFile, { upsert: true });

            console.log('🚀 Gửi job CLEAN:', { inputVideo: videoPath, outputName: mergedOutput });
            await fetch('/api/clean-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputVideo: videoPath, outputName: mergedOutput }),
            });

            console.log('⏳ Đang theo dõi tiến trình merge...');
            await checkMergeCompletion(outputPath);
        } catch (error) {
            console.error('❌ Lỗi trong quá trình upload:', error);
            alert('Lỗi khi xử lý video/audio!');
        }

        setIsProcessing(false);
    };

    const checkMergeCompletion = async (outputPath: string) => {
        for (let i = 0; i < 30; i++) {
            const { data, error } = await supabase.storage.from('stream-files').createSignedUrl(outputPath, 60);
            if (error) {
                console.warn('⚠️ Lỗi lấy signed URL:', error.message);
                await new Promise((r) => setTimeout(r, 3000));
                continue;
            }

            if (data?.signedUrl) {
                const res = await fetch(data.signedUrl);
                if (res.ok) {
                    console.log('✅ File merge hoàn tất:', data.signedUrl);
                    setMergedUrl(data.signedUrl);
                    return;
                }
            }

            await new Promise((r) => setTimeout(r, 3000));
        }

        alert('❌ Xử lý quá lâu, thử lại sau.');
    };

    const toggleStream = async () => {
        if (!mergedUrl) return;

        if (!isStreaming) {
            alert('▶️ Bắt đầu livestream');
            setIsStreaming(true);
        } else {
            alert('⛔ Kết thúc livestream (sẽ xoá file sau 5 phút)');
            setIsStreaming(false);

            console.log('🚀 Gửi yêu cầu dừng stream:', outputName);
            await fetch('/api/stop-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputName }),
            });
        }
    };

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
            <h1>📤 Upload video + audio để phát livestream</h1>

            <input type="file" accept="video/mp4" onChange={(e) => handleFileChange(e, 'video')} style={{ marginBottom: 12 }} />
            <input type="file" accept="audio/mp3" onChange={(e) => handleFileChange(e, 'audio')} style={{ marginBottom: 12 }} />

            <button
                onClick={handleUpload}
                style={{
                    padding: 10,
                    background: '#007bff',
                    color: 'white',
                    marginTop: 10,
                    border: 'none',
                    borderRadius: 6
                }}
                disabled={!videoFile || !audioFile || isProcessing}
            >
                ⏫ Upload và xử lý
            </button>

            {isProcessing && <p>⏳ Đang xử lý video + audio...</p>}

            {mergedUrl && (
                <>
                    <button
                        onClick={toggleStream}
                        style={{
                            padding: 10,
                            background: isStreaming ? '#dc3545' : '#28a745',
                            color: 'white',
                            marginTop: 20,
                            borderRadius: 6
                        }}
                    >
                        {isStreaming ? '⛔ Kết thúc livestream' : '▶️ Bắt đầu livestream'}
                    </button>

                    <div style={{ marginTop: 20 }}>
                        <a href={mergedUrl} download>⬇️ Tải video hoàn chỉnh</a>
                        <p style={{ color: 'orange', fontSize: 13 }}>
                            ⚠️ File đã merge, sẽ tự động xoá sau khi kết thúc livestream.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
