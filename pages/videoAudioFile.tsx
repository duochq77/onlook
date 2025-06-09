'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'

export default function VideoAudioFile() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [status, setStatus] = useState('')
    const [sessionId, setSessionId] = useState('')

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('❗ Vui lòng chọn đủ 2 file!')

        const sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        setSessionId(sid)

        setStatus('📤 Đang tải lên Supabase và gửi job...')

        const formData = new FormData()
        formData.append('video', videoFile)
        formData.append('audio', audioFile)

        const res = await fetch('/api/run-process-job', {
            method: 'POST',
            body: formData,
        })

        if (!res.ok) {
            const errText = await res.text()
            console.error('❌ Upload hoặc job lỗi:', errText)
            setStatus('❌ Upload hoặc job lỗi.')
            return
        }

        let outputName = ''
        try {
            const data = await res.json()
            outputName = data.outputName
        } catch (e) {
            console.error('❌ Lỗi khi đọc phản hồi JSON:', e)
            setStatus('❌ Job lỗi: Không thể đọc phản hồi.')
            return
        }

        const file = outputName.replace('merged-', '')
        setStatus('⏳ Đã gửi job. Đang kiểm tra file kết quả...')

        const poll = async () => {
            for (let i = 0; i < 30; i++) {
                const res = await fetch(`/api/check-merged?file=${outputName}`)
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
                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/stream-files/outputs/merged-${sessionId}.mp4`}
                    download
                    className="underline text-green-700"
                >
                    ⬇️ Tải file hoàn chỉnh
                </a>
            )}
        </main>
    )
}
