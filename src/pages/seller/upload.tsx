import { useState } from 'react'
import axios from 'axios'

export default function SellerUploadPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!videoFile || !audioFile) {
            alert('Vui lòng chọn cả video (.mp4) và audio (.mp3)')
            return
        }

        setLoading(true)
        setResult(null)

        try {
            // Convert files to base64
            const videoBase64 = await fileToBase64(videoFile)
            const audioBase64 = await fileToBase64(audioFile)

            const folder = 'tmp'
            const videoRes = await axios.post('/api/upload', {
                file: videoBase64,
                filename: videoFile.name,
                folder
            })

            const audioRes = await axios.post('/api/upload', {
                file: audioBase64,
                filename: audioFile.name,
                folder
            })

            const inputVideo = videoRes.data.path
            const inputAudio = audioRes.data.path
            const outputName = `output-${Date.now()}.mp4`

            // Gửi job xử lý vào Redis
            await axios.post('/api/upload-job', {
                inputVideo: `/tmp/${videoFile.name}`,
                inputAudio: `/tmp/${audioFile.name}`,
                outputName
            })

            setResult('✅ Đã upload xong và gửi job xử lý!')
        } catch (err) {
            console.error(err)
            setResult('❌ Có lỗi xảy ra.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">🎥 Seller Upload</h1>

            <div className="mb-4">
                <label className="block mb-1 font-semibold">Chọn file video (.mp4):</label>
                <input type="file" accept="video/mp4" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            </div>

            <div className="mb-4">
                <label className="block mb-1 font-semibold">Chọn file audio (.mp3):</label>
                <input type="file" accept="audio/mp3" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
            </div>

            <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleUpload}
                disabled={loading}
            >
                {loading ? 'Đang upload...' : '🚀 Upload & Gửi Job'}
            </button>

            {result && <p className="mt-4 font-medium">{result}</p>}
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
