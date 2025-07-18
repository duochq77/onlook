'use client'
import { useState } from 'react'

export default function VideoSingleFile() {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [room, setRoom] = useState('')
    const [fileKey, setFileKey] = useState('')
    const [status, setStatus] = useState('')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setIsUploading(true)
        setStatus('STEP 1: Upload video lên R2...')

        const formData = new FormData()
        formData.append('file', file)

        // ✅ Sửa tại đây: không gắn sẵn /upload
        const ingressUrl = process.env.NEXT_PUBLIC_INGRESS_WORKER_URL || 'https://onlook-ingress-url-from-env'

        try {
            const res = await fetch(`${ingressUrl}/upload`, {
                method: 'POST',
                body: formData,
            })

            const text = await res.text()
            let data: any = {}

            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('❌ Không thể parse JSON:', text)
                setStatus('❌ Upload thất bại (response không hợp lệ)')
                return
            }

            if (res.ok) {
                setRoom(data.roomName)
                setFileKey(data.fileKey)
                setStatus(`🚀 Đã tạo room: ${data.roomName}, file: ${data.fileKey}`)
            } else {
                setStatus(`❌ Upload thất bại: ${data.error || 'Không rõ nguyên nhân'}`)
            }
        } catch (err) {
            console.error('❌ Lỗi khi upload:', err)
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

        const deleteUrl = process.env.NEXT_PUBLIC_DELETE_WORKER_URL || 'https://onlook-delete-url-from-env'

        try {
            const res = await fetch(`${deleteUrl}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName: room, fileKey }),
            })

            const text = await res.text()
            let data: any = {}

            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('❌ Không thể parse JSON khi dừng:', text)
                setStatus('❌ Lỗi khi dừng: Phản hồi không hợp lệ')
                return
            }

            if (res.ok) {
                setStatus('✅ Đã dừng livestream và xoá file thành công')
                setRoom('')
                setFileKey('')
                setFile(null)
            } else {
                setStatus(`❌ Lỗi khi dừng: ${data.error || 'Không rõ nguyên nhân'}`)
            }
        } catch (err) {
            console.error('❌ Lỗi khi gọi delete worker:', err)
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
