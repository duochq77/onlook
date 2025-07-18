'use client'
import { useState } from 'react'

export default function VideoSingleFile() {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [room, setRoom] = useState('')
    const [fileKey, setFileKey] = useState('')
    const [status, setStatus] = useState('')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setIsUploading(true)
        setStatus('STEP 1: Upload video lên R2...')

        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_INGRESS_WORKER_URL}/upload`, {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (res.ok) {
                setRoom(data.roomName)
                setFileKey(data.fileKey)
                setStatus(`🚀 Đã tạo room: ${data.roomName}, file: ${data.fileKey}`)
            } else {
                setStatus('❌ Upload thất bại')
            }
        } catch (err) {
            console.error('Lỗi:', err)
            setStatus('❌ Lỗi khi upload video')
        } finally {
            setIsUploading(false)
        }
    }

    const handleStop = async () => {
        if (!room || !fileKey) {
            setStatus('❌ Thiếu room hoặc file để dừng')
            return
        }

        setStatus('🛑 Đang dừng livestream...')

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_DELETE_WORKER_URL}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName: room, fileKey: fileKey }),
            })

            if (res.ok) {
                setStatus('✅ Đã dừng livestream và xoá file thành công')
                setRoom('')
                setFileKey('')
                setFile(null)
            } else {
                const data = await res.json()
                setStatus(`❌ Lỗi khi dừng: ${data.error || 'Không rõ nguyên nhân'}`)
            }
        } catch (err) {
            console.error('Lỗi:', err)
            setStatus('❌ Lỗi khi gọi worker delete')
        }
    }

    return (
        <div style={{ padding: 20 }}>
            <h2>🎬 Upload Video Livestream (Phương thức 4)</h2>
            <input type="file" accept="video/mp4" onChange={handleFileChange} />
            <button onClick={handleUpload} disabled={isUploading || !file}>
                {isUploading ? 'Uploading...' : 'Tải lên & Tạo Livestream'}
            </button>

            {room && fileKey && (
                <button
                    onClick={handleStop}
                    style={{ marginLeft: 10 }}
                    disabled={isUploading}
                >
                    🛑 Dừng Livestream & Xoá file
                </button>
            )}

            <div style={{ marginTop: 20 }}>
                <p><strong>Trạng thái:</strong> {status}</p>
            </div>
        </div>
    )
}
