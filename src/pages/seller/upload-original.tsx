import { useState } from 'react'
import axios from 'axios'

export default function UploadOriginalVideo() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!videoFile) {
            alert('Vui lòng chọn file video .mp4')
            return
        }

        setLoading(true)
        setMessage(null)

        try {
            const base64 = await fileToBase64(videoFile)

            const res = await axios.post('/api/upload-original-video', {
                file: base64,
                filename: videoFile.name
            })

            setMessage(`✅ Đã gửi thành công. Video: ${res.data.videoUrl}`)
        } catch (err) {
            console.error('❌ Upload lỗi:', err)
            setMessage('❌ Lỗi khi gửi video.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">📤 Upload Video Gốc</h1>

            <input type="file" accept="video/mp4" onChange={e => setVideoFile(e.target.files?.[0] || null)} />

            <button
                onClick={handleUpload}
                disabled={loading}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Đang gửi...' : '🚀 Gửi video để tách âm'}
            </button>

            {message && <p className="mt-4 font-medium">{message}</p>}
        </div>
    )
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}
