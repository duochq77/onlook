import React, { useState } from 'react'
import axios from 'axios'

export default function UploadOriginalVideo() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!videoFile) return
        setUploading(true)

        const reader = new FileReader()
        reader.readAsDataURL(videoFile)
        reader.onloadend = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1]
                const res = await axios.post('/api/upload-original-video', {
                    file: base64,
                    filename: videoFile.name,
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
            <h1 className="text-xl font-bold mb-4">Upload Video Gốc</h1>
            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            <button
                onClick={handleUpload}
                disabled={!videoFile || uploading}
                className="mt-4 bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
                {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {uploadedUrl && (
                <p className="mt-4 break-all">
                    Uploaded video URL: <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-purple-700 underline">{uploadedUrl}</a>
                </p>
            )}
        </div>
    )
}
