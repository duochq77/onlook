import React, { useState } from 'react'
import axios from 'axios'

export default function UploadAudioPage() {
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!audioFile) return
        setUploading(true)

        const reader = new FileReader()
        reader.readAsDataURL(audioFile)
        reader.onloadend = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1]
                const res = await axios.post('/api/upload', {
                    file: base64,
                    filename: audioFile.name,
                    folder: 'tmp',
                })
                setUploadedUrl(res.data.url)
            } catch (err) {
                alert('Upload failed')
            } finally {
                setUploading(false)
            }
        }
    }

    return (
        <div className="p-6 max-w-md mx-auto">
            <h1 className="text-xl font-bold mb-4">Upload Audio (.mp3)</h1>
            <input type="file" accept="audio/mp3" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            <button
                onClick={handleUpload}
                disabled={!audioFile || uploading}
                className="mt-4 bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
                {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {uploadedUrl && (
                <p className="mt-4 break-all">
                    Uploaded audio URL: <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-green-700 underline">{uploadedUrl}</a>
                </p>
            )}
        </div>
    )
}
