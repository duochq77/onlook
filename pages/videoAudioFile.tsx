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
        if (!videoFile || !audioFile) return alert('❗ Vui lòng chọn đủ 2 file!')

        const sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        setSessionId(sid)

        const videoName = `input-${sid}.mp4`
        const audioName = `input-${sid}.mp3`
        const outputName = `merged-${sid}.mp4`

        const videoPath = `${STORAGE_PATH}/input-videos/${videoName}`
        const audioPath = `${STORAGE_PATH}/input-audios/${audioName}`
        const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${videoPath}`
        const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${audioPath}`

        setStatus('📤 Đang tải lên Supabase...')

        const { error: videoErr } = await supabase.storage
            .from(STORAGE_PATH)
            .upload(`input-videos/${videoName}`, videoFile, { upsert: true })

        const { error: audioErr } = await supabase.storage
            .from(STORAGE_PATH)
            .upload(`input-audios/${audioName}`, audioFile, { upsert: true })

        if (videoErr || audioErr) {
            console.error('❌ Upload lỗi:', videoErr || audioErr)
            setStatus('❌ Upload thất bại.')
            return
        }

        const videoCheck = await fetch(videoUrl)
        const audioCheck = await fetch(audioUrl)

        if (!videoCheck.ok || !audioCheck.ok) {
            setStatus('❌ File video hoặc audio chưa tồn tại công khai!')
            return
        }

        setStatus('🚀 Đã tải lên. Đang gửi job xử lý...')

        const runRes = await fetch(`https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/process-video-worker:run`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taskOverrides: {
                    env: [
                        { name: 'OUTPUT_NAME', value: outputName },
                        { name: 'INPUT_VIDEO_URL', value: videoUrl },
                        { name: 'INPUT_AUDIO_URL', value: audioUrl },
                    ],
                },
            }),
        })

        if (!runRes.ok) {
            setStatus('❌ Gửi job xử lý thất bại!')
            console.error('❌ Job lỗi:', await runRes.text())
            return
        }

        setStatus('⏳ Đã gửi job. Đang kiểm tra file kết quả...')

        const poll = async () => {
            for (let i = 0; i < 30; i++) {
                const res = await fetch(`https://onlook-process-upload-ncdt2ep7dq-as.a.run.app/check?file=merged-${sid}.mp4`)
                const json = await res.json()
                if (json.exists) {
                    setStatus('✅ File đã sẵn sàng. Bạn có thể tải về.')
                    return
                }
                await new Promise((r) => setTimeout(r, 3000))
            }
            setStatus('❌ Quá thời gian chờ. Vui lòng thử lại.')
        }

        poll()
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
                    className="underline text-green-700"
                >
                    ⬇️ Tải file hoàn chỉnh
                </a>
            )}
        </main>
    )
}
