'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function VideoAudioFile() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [status, setStatus] = useState('')
    const [sessionId, setSessionId] = useState('')

    const STORAGE_PATH = 'stream-files'
    const token = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_RUN_TOKEN!

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('Vui lòng chọn đủ 2 file!')

        const sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        setSessionId(sid)

        const videoName = `input-${sid}.mp4`
        const audioName = `input-${sid}.mp3`
        const outputName = `merged-${sid}.mp4`

        // ✅ Upload file video
        setStatus('📤 Đang tải video lên Supabase...')
        const { error: videoErr } = await supabase.storage
            .from(STORAGE_PATH)
            .upload(`input-videos/${videoName}`, videoFile)
        if (videoErr) {
            setStatus('❌ Upload video lỗi: ' + videoErr.message)
            return
        }

        // ✅ Upload file audio
        setStatus('📤 Đang tải audio lên Supabase...')
        const { error: audioErr } = await supabase.storage
            .from(STORAGE_PATH)
            .upload(`input-audios/${audioName}`, audioFile)
        if (audioErr) {
            setStatus('❌ Upload audio lỗi: ' + audioErr.message)
            return
        }

        setStatus('🚀 Đã upload xong. Đang gửi job xử lý...')

        // ✅ Gửi job xử lý qua Cloud Run
        await fetch(
            `https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/process-video-worker:run`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    overrides: {
                        containerOverrides: [
                            {
                                name: 'onlook-process-video',
                                env: [
                                    { name: 'OUTPUT_NAME', value: outputName },
                                    {
                                        name: 'INPUT_VIDEO_URL',
                                        value: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_PATH}/input-videos/${videoName}`,
                                    },
                                    {
                                        name: 'INPUT_AUDIO_URL',
                                        value: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_PATH}/input-audios/${audioName}`,
                                    },
                                ],
                            },
                        ],
                    },
                }),
            }
        )

        setStatus('⏳ Đã gửi job xử lý, đang chờ hoàn tất...')

        // ✅ Kiểm tra kết quả qua endpoint upload worker
        const check = async () => {
            for (let i = 0; i < 30; i++) {
                const res = await fetch(
                    `https://onlook-process-upload-ncdt2ep7dq-as.a.run.app/check?file=${outputName}`
                )
                const json = await res.json()
                if (json.exists) {
                    setStatus('✅ File đã xử lý xong! Bạn có thể tải xuống.')
                    return
                }
                await new Promise((r) => setTimeout(r, 2000))
            }
            setStatus('❌ Hết thời gian chờ kết quả.')
        }

        check()
    }

    return (
        <main className="p-4 space-y-4">
            <h1 className="text-xl font-bold">🎬 Phương thức 3 – Giai đoạn 1</h1>

            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            <input type="file" accept="audio/mpeg" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />

            <button
                onClick={handleUpload}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={!videoFile || !audioFile}
            >
                ⏫ Tải lên & xử lý
            </button>

            <p>{status}</p>
        </main>
    )
}
