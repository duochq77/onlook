// File: src/pages/seller/videoAudioFile.tsx

import React, { useRef, useState } from 'react'

const sampleVideos = [
    {
        name: 'Video mẫu 1',
        url: 'https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/sample-videos/sample1.mp4'
    },
    {
        name: 'Video mẫu 2',
        url: 'https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/sample-videos/sample2.mp4'
    }
]

const sampleAudios = [
    {
        name: 'Audio mẫu 1',
        url: 'https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/sample-audios/sample1.mp3'
    },
    {
        name: 'Audio mẫu 2',
        url: 'https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/sample-audios/sample2.mp3'
    }
]

export default function VideoAudioFilePage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [useSample, setUseSample] = useState(false)
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [videoURL, setVideoURL] = useState('')
    const [audioURL, setAudioURL] = useState('')

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio') => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            if (type === 'video') {
                setVideoFile(file)
                setVideoURL(url)
            } else {
                setAudioFile(file)
                setAudioURL(url)
            }
        }
    }

    const handleSampleSelect = (type: 'video' | 'audio', url: string) => {
        if (type === 'video') setVideoURL(url)
        else setAudioURL(url)
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold">Phương thức 3: Phát video + audio từ 2 file riêng</h1>

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
                    Chọn từ mẫu có sẵn
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
                        <label className="font-medium">Chọn video mẫu:</label>
                        <select onChange={(e) => handleSampleSelect('video', e.target.value)} className="ml-2">
                            <option value="">-- Chọn --</option>
                            {sampleVideos.map((v, i) => (
                                <option key={i} value={v.url}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="font-medium">Chọn audio mẫu:</label>
                        <select onChange={(e) => handleSampleSelect('audio', e.target.value)} className="ml-2">
                            <option value="">-- Chọn --</option>
                            {sampleAudios.map((a, i) => (
                                <option key={i} value={a.url}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="mt-4">
                <video ref={videoRef} src={videoURL} autoPlay loop muted controls className="w-full max-w-xl" />
                <audio ref={audioRef} src={audioURL} autoPlay loop hidden />
            </div>
        </div>
    )
}
