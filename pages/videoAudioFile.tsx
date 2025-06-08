'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'

export default function VideoAudioFile() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [status, setStatus] = useState('')
    const [sessionId, setSessionId] = useState('')

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('Vui lòng chọn đủ 2 file!')

        const sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        setSessionId(sid)

        const videoName = `input-${sid}.mp4`
        const audioName = `input-${sid}.mp3`
        const outputName = `merged-${sid}.mp4`

        // Upload video & audio lên Supabase
        const upload = async (file: File, path: string) => {
            const res = await fetch(`https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/upload/sign/${path}`, {
                method: 'POST',
                headers: {
                    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`
                },
                body: file
            })
            return res.ok
        }

        setStatus('📤 Đang tải lên Supabase...')
        await upload(videoFile, `stream-files/input-videos/${videoName}`)
        await upload(audioFile, `stream-files/input-audios/${audioName}`)

        setStatus('🚀 Đã tải xong. Đang khởi động xử lý...')

        // Gọi job process
        await fetch(
            'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/process-video-worker:run',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_GOOGLE_CLOUD_RUN_TOKEN!}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    envs: [
                        { name: 'OUTPUT_NAME', value: outputName },
                        { name: 'INPUT_VIDEO_URL', value: `https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/stream-files/input-videos/${videoName}` },
                        { name: 'INPUT_AUDIO_URL', value: `https://hlfhsozgnjxzwzqgjpbk.supabase.co/storage/v1/object/public/stream-files/input-audios/${audioName}` }
                    ]
                })
            }
        )

        setStatus('⏳ Đã gửi job xử lý, đang chờ hoàn tất...')

        // Poll kết quả
        const check = async () => {
            for (let i = 0; i < 30; i++) {
                const res = await fetch(`https://onlook-process-upload-ncdt2ep7dq-as.a.run.app/check?file=${outputName}`)
                const json = await res.json()
                if (json.exists) {
                    setStatus('✅ File đã sẵn sàng. Bạn có thể tải về.')
                    return
                }
                await new Promise((r) => setTimeout(r, 2000))
            }
            setStatus('❌ Hết thời gian chờ. Vui lòng thử lại.')
        }

        check()
    }

    const handleDownload = async () => {
        setStatus('♻️ Gửi yêu cầu xoá file gốc...')

        await fetch(
            'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/cleanup-worker:run',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_GOOGLE_CLOUD_RUN_TOKEN!}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    envs: [
                        { name: 'VIDEO_FILE', value: `input-${sessionId}.mp4` },
                        { name: 'AUDIO_FILE', value: `input-${sessionId}.mp3` }
                    ]
                })
            }
        )

        setStatus('🧹 Đã gửi yêu cầu cleanup.')
    }

    return (
        <main className="p-4 space-y-4">
            <h1 className="text-xl font-bold">🎬 Phương thức 3 – Giai đoạn 1</h1>

            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            <input type="file" accept="audio/mpeg" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />

            <button onClick={handleUpload} className="bg-blue-600 text-white px-4 py-2 rounded">
                Tải lên & xử lý
            </button>

            <p>{status}</p>

            {status.includes('✅') && (
                <a
                    href={`https://onlook-process-upload-ncdt2ep7dq-as.a.run.app/tmp/merged-${sessionId}.mp4`}
                    download
                    onClick={handleDownload}
                    className="underline text-green-700"
                >
                    ⬇️ Tải file hoàn chỉnh
                </a>
            )}
        </main>
    )
}
