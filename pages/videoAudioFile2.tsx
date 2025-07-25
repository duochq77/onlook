'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'

export default function VideoAudioFile2() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [status, setStatus] = useState('')
    const [jobId, setJobId] = useState('')
    const [downloadUrl, setDownloadUrl] = useState('')
    const [readyAt, setReadyAt] = useState<number | null>(null)

    useEffect(() => {
        localStorage.removeItem('latestJobId')
        localStorage.removeItem('expiredAt')
        localStorage.removeItem('manualUpload')

        setJobId('')
        setVideoFile(null)
        setAudioFile(null)
        setDownloadUrl('')
        setReadyAt(null)
        setStatus('')
    }, [])

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            alert('❗ Vui lòng chọn đủ 2 file!')
            return
        }

        const formData = new FormData()
        formData.append('video', videoFile)
        formData.append('audio', audioFile)

        setStatus('📤 Đang tải lên R2...')

        try {
            const res = await fetch('/api/create-process-job', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Upload thất bại')

            const newJobId = data.outputKey.split('-')[1] || 'unknown'
            setJobId(newJobId)
            setStatus('⏳ Đã gửi job. Đang chờ xử lý...')
        } catch (err) {
            console.error('❌ Lỗi upload:', err)
            setStatus('❌ Upload thất bại.')
        }
    }

    useEffect(() => {
        if (!jobId) return

        const interval = setInterval(async () => {
            const outputName = `merged-${jobId}.mp4`
            console.log('⏱️ Bắt đầu kiểm tra trạng thái đầu ra...')

            const res = await fetch(`/api/check-output-exists2?outputName=${outputName}`)
            const data = await res.json()

            if (data.exists && data.downloadUrl) {
                setDownloadUrl(data.downloadUrl)
                setStatus('✅ File đã sẵn sàng tải về.')
                if (!readyAt) setReadyAt(Date.now())
            } else {
                setDownloadUrl('')
                setStatus('⏳ Đang chờ xử lý...')
            }

            if (readyAt) {
                const timePassed = Date.now() - readyAt
                if (timePassed > 5 * 60 * 1000) {
                    console.warn('🧯 File đã hết hạn tải.')
                    setDownloadUrl('')
                    setStatus('⏳ File đã hết hạn tải về.')
                }
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [jobId, readyAt])

    return (
        <main className="p-4 space-y-4">
            <h1 className="text-xl font-bold">🎬 Phương thức 3 – Giai đoạn 1 (R2)</h1>

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
