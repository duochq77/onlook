'use client'

import { useState } from 'react'

export default function VideoAudioFile() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [outputName, setOutputName] = useState('')
    const [status, setStatus] = useState('')

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert('Vui lòng chọn đủ 2 file!')

        const output = `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`
        setOutputName(output)

        const formData = new FormData()
        formData.append('video', videoFile)
        formData.append('audio', audioFile)
        formData.append('outputName', output)

        // Upload file lên Cloud Run Worker
        const uploadURL = `https://onlook-process-upload-ncdt2ep7dq-as.a.run.app/upload`
        const uploadRes = await fetch(uploadURL, {
            method: 'POST',
            body: formData,
        })

        if (!uploadRes.ok) {
            setStatus('❌ Upload thất bại')
            return
        }

        setStatus('📤 Upload thành công. Đang khởi động xử lý...')

        // Gọi Cloud Run Job, truyền outputName qua ENV
        const triggerURL = 'https://asia-southeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/onlook-main/jobs/process-video-worker:run'

        await fetch(triggerURL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_GOOGLE_CLOUD_RUN_TOKEN!}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                envs: [{ name: 'OUTPUT_NAME', value: output }],
            }),
        })

        setStatus('🚀 Đã gửi lệnh xử lý. Đang chờ kết quả...')

        // Polling file: giới hạn 30 lần (60 giây)
        const checkExist = async () => {
            for (let i = 0; i < 30; i++) {
                const res = await fetch(`https://onlook-process-upload-ncdt2ep7dq-as.a.run.app/check?file=${output}`)
                const json = await res.json()
                if (json.exists) {
                    setStatus('✅ Đã xử lý xong. Bấm nút bên dưới để tải về')
                    return
                }
                await new Promise((r) => setTimeout(r, 2000)) // Đợi 2 giây rồi thử lại
            }
            setStatus('❌ Hết thời gian chờ (60 giây). Vui lòng thử lại.')
        }

        checkExist()
    }

    return (
        <main className="p-4 space-y-4">
            <h1 className="text-xl font-bold">🎬 Phát video + âm thanh riêng (Giai đoạn 1)</h1>

            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            <input type="file" accept="audio/mpeg" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            <button onClick={handleUpload} className="px-4 py-2 bg-blue-600 text-white rounded">Tải lên & Bắt đầu xử lý</button>

            <p>{status}</p>

            {status.includes('✅') && (
                <a
                    href={`https://onlook-process-upload-ncdt2ep7dq-as.a.run.app/tmp/${outputName}`}
                    download
                    className="underline text-green-700"
                >
                    ⬇️ Tải file hoàn chỉnh
                </a>
            )}
        </main>
    )
}
