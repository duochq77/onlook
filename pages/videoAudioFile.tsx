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
    const [readyAt, setReadyAt] = useState<number | null>(null)

    const STORAGE_PATH = 'stream-files'

    useEffect(() => {
        // Reset file input khi reload
        setVideoFile(null)
        setAudioFile(null)

        const stored = localStorage.getItem('latestJobId')
        const expired = localStorage.getItem('expiredAt')

        if (stored && expired && Date.now() < parseInt(expired) && !jobId) {
            console.log('📦 Khôi phục jobId từ localStorage:', stored)
            setJobId(stored)
        } else {
            // Xoá nếu đã hết hạn
            localStorage.removeItem('latestJobId')
            localStorage.removeItem('expiredAt')
        }
    }, [])

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            alert('❗ Vui lòng chọn đủ 2 file!')
            return
        }

        const newJobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        setJobId(newJobId)
        localStorage.setItem('latestJobId', newJobId)

        const videoName = `input-${newJobId}.mp4`
        const audioName = `input-${newJobId}.mp3`
        const outputName = `merged-${newJobId}.mp4`

        const videoPath = `${STORAGE_PATH}/input-videos/${videoName}`
        const audioPath = `${STORAGE_PATH}/input-audios/${audioName}`

        console.log('📤 Bắt đầu upload:')
        console.log('- videoPath:', videoPath)
        console.log('- audioPath:', audioPath)

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

        const videoUrl = supabase.storage.from(STORAGE_PATH).getPublicUrl(`input-videos/${videoName}`).data.publicUrl
        const audioUrl = supabase.storage.from(STORAGE_PATH).getPublicUrl(`input-audios/${audioName}`).data.publicUrl

        console.log('🌐 Video URL:', videoUrl)
        console.log('🌐 Audio URL:', audioUrl)

        const videoCheck = await fetch(videoUrl)
        const audioCheck = await fetch(audioUrl)
        if (!videoCheck.ok || !audioCheck.ok) {
            console.error('❌ File chưa tồn tại công khai!')
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

        console.log('📨 Đã gửi job thành công:', newJobId)
        setStatus('⏳ Đã gửi job. Đang chờ xử lý...')

        // Lưu thời gian hết hạn
        const expiresAt = Date.now() + 5 * 60 * 1000
        localStorage.setItem('expiredAt', expiresAt.toString())
    }

    useEffect(() => {
        if (!jobId || jobId.startsWith('undefined')) return

        const interval = setInterval(async () => {
            const outputName = `merged-${jobId}.mp4`
            console.log('⏱️ Bắt đầu kiểm tra trạng thái đầu ra...')
            console.log('🔍 Kiểm tra file:', outputName)

            const res = await fetch(`/api/check-output-exists?outputName=${outputName}`)
            const data = await res.json()
            console.log('📥 Phản hồi từ API check-output:', data)

            if (data.exists && data.downloadUrl) {
                console.log('✅ File đã sẵn sàng tải về:', data.downloadUrl)
                setDownloadUrl(data.downloadUrl)
                setStatus('✅ File đã sẵn sàng tải về.')
                if (!readyAt) {
                    setReadyAt(Date.now())

                    // Sau khi sẵn sàng, dọn localStorage
                    localStorage.removeItem('latestJobId')
                    localStorage.removeItem('expiredAt')
                }
            } else {
                console.log('📉 File chưa sẵn sàng hoặc không có downloadUrl.')
                setDownloadUrl('')
                setStatus('⏳ Đang chờ xử lý...')
            }

            if (readyAt) {
                const timePassed = Date.now() - readyAt
                console.log('⏰ Kiểm tra hết hạn tải...', `${Math.round(timePassed / 1000)}s đã trôi qua`)
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
