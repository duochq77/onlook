'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function VideoAudioFile() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [status, setStatus] = useState('')
    const [jobId, setJobId] = useState('')
    const [downloadUrl, setDownloadUrl] = useState('')

    const STORAGE_PATH = 'stream-files'

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            alert('❗ Vui lòng chọn đủ 2 file!')
            return
        }

        const newJobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        setJobId(newJobId)

        const videoName = `input-${newJobId}.mp4`
        const audioName = `input-${newJobId}.mp3`
        const outputName = `merged-${newJobId}.mp4`

        const videoPath = `${STORAGE_PATH}/input-videos/${videoName}`
        const audioPath = `${STORAGE_PATH}/input-audios/${audioName}`

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

        // ✅ Đã sửa: dùng .getPublicUrl thay vì ghép tay
        const videoUrl = supabase.storage.from(STORAGE_PATH).getPublicUrl(`input-videos/${videoName}`).data.publicUrl
        const audioUrl = supabase.storage.from(STORAGE_PATH).getPublicUrl(`input-audios/${audioName}`).data.publicUrl

        if (!videoUrl || !audioUrl) {
            setStatus('❌ Không tạo được URL công khai!')
            return
        }

        const videoCheck = await fetch(videoUrl)
        const audioCheck = await fetch(audioUrl)
        if (!videoCheck.ok || !audioCheck.ok) {
            setStatus('❌ File chưa tồn tại công khai!')
            return
        }

        setStatus('🚀 Đã upload. Đang gửi job xử lý...')

        const runRes = await fetch('/api/create-process-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: newJobId,
                videoUrl,
                audioUrl,
                outputName,
            }),
        })

        if (!runRes.ok) {
            const err = await runRes.json().catch(() => null)
            console.error('❌ Job lỗi:', err)
            setStatus('❌ Gửi job xử lý thất bại!')
            return
        }

        setStatus('⏳ Đã gửi job. Đang chờ xử lý...')
    }

    useEffect(() => {
        if (!jobId) return
        const interval = setInterval(async () => {
            const outputName = `merged-${jobId}.mp4`
            const res = await fetch(`/api/check-output-exists?outputName=${outputName}`)
            const data = await res.json()
            if (data.exists) {
                const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/stream-files/outputs/${outputName}`
                setDownloadUrl(publicUrl)
                setStatus('✅ File đã sẵn sàng tải về.')
            } else {
                setDownloadUrl('')
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [jobId])

    return (
        <main className="p-4 space-y-4">
            <h1 className="text-xl font-bold">🎬 Phương thức 3 – Giai đoạn 1</h1>

            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            <input type="file" accept="audio/mpeg" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />

            <button onClick={handleUpload} className="bg-blue-600 text-white px-4 py-2 rounded">
                Tải lên & xử lý
            </button>

            <p>{status}</p>

            {downloadUrl && (
                <a
                    href={downloadUrl}
                    download
                    className="inline-block mt-2 bg-green-600 text-white px-4 py-2 rounded"
                >
                    ⬇️ Tải về file hoàn chỉnh
                </a>
            )}
        </main>
    )
}
