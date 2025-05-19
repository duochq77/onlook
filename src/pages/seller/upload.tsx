import React, { useState } from 'react'
import axios from 'axios'

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)

        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onloadend = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1] // lấy base64 thôi
                const res = await axios.post('/api/upload', {
                    file: base64,
                    filename: file.name,
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
            <h1 className="text-xl font-bold mb-4">Upload Video/Audio</h1>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
                {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {uploadedUrl && (
                <p className="mt-4 break-all">
                    Uploaded file URL: <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">{uploadedUrl}</a>
                </p>
            )}
        </div>
    )
}
