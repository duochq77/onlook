"use client"

import { useEffect, useRef, useState } from "react"

export default function VideoAudioFile2() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [outputUrl, setOutputUrl] = useState<string | null>(null)
    const [jobId, setJobId] = useState<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const handleUpload = async () => {
        if (!videoFile || !audioFile) return alert("Chọn đủ cả video và audio")

        const form = new FormData()
        form.append("video", videoFile)
        form.append("audio", audioFile)

        try {
            const res = await fetch("https://create-process-job-729288097042.asia-southeast1.run.app/create", {
                method: "POST",
                body: form,
            })

            if (!res.ok) {
                const errText = await res.text()
                console.error("❌ Upload error", errText)
                return alert("Lỗi khi upload file: " + res.status)
            }

            const data = await res.json()
            if (!data.outputKey) return alert("Tạo job thất bại")

            console.log("🎯 jobId (outputKey):", data.outputKey)
            setJobId(data.outputKey) // ✅ sử dụng outputKey làm jobId
        } catch (err) {
            console.error("❌ Upload exception", err)
            alert("Có lỗi khi gửi yêu cầu")
        }
    }

    useEffect(() => {
        if (!jobId) return

        intervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/check-output-exists2?jobId=${jobId}`)
                const data = await res.json()

                if (data.exists && data.downloadUrl) {
                    clearInterval(intervalRef.current!)
                    setOutputUrl(data.downloadUrl)
                }
            } catch (err) {
                console.error("❌ Polling error:", err)
            }
        }, 4000)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [jobId])

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold">Upload Video + Audio để xử lý (R2)</h1>

            <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />
            <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
            />

            <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleUpload}
                disabled={!videoFile || !audioFile}
            >
                Tải lên và xử lý
            </button>

            {outputUrl && (
                <div>
                    <p className="mt-4 text-green-600 font-medium">✅ File đã sẵn sàng:</p>
                    <a
                        href={outputUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline"
                    >
                        Tải về file kết quả
                    </a>
                </div>
            )}
        </div>
    )
}
