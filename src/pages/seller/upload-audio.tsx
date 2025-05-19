import { useState } from 'react'
import axios from 'axios'

export default function UploadAudioPage() {
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [outputName, setOutputName] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!audioFile || !outputName) {
            alert('Vui lòng nhập outputName và chọn file .mp3')
            return
        }

        setLoading(true)
        setMessage(null)

        try {
            const base64 = await fileToBase64(audioFile)

            // 1. Upload audio
            const res = await axios.post('/api/upload', {
                file: base64,
                filename: audioFile.name,
                folder: 'tmp'
            })

            const inputVideo = `tmp/clean-${outputName}`
            const inputAudio = res.data.path
            const finalOutput = outputName // không thêm clean-, vì đây là tên file cuối

            // 2. Đẩy job vào Redis để ghép
            await axios.post('/api/upload-job', {
                inputVideo,
                inputAudio,
                outputName: finalOutput
            })

            setMessage(`✅ Đã gửi job ghép video: ${finalOutput}`)
        } catch (err) {
            console.error(err)
            setMessage('❌ Lỗi khi upload audio hoặc đẩy job.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">🔊 Upload File Audio (.mp3)</h1>

            <label className="block mb-2 font-medium">Tên output file (đã clean):</label>
            <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="vd: 234234-abc.mp4"
                className="border px-3 py-2 rounded w-full mb-4"
            />

            <input type="file" accept="audio/mp3" onChange={e => setAudioFile(e.target.files?.[0] || null)} />

            <button
                onClick={handleUpload}
                disabled={loading}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Đang xử lý...' : '🚀 Gửi audio và ghép video'}
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
