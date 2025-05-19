import React, { useEffect, useState } from 'react'
import { supabase } from '@/services/SupabaseService'

const bucket = process.env.SUPABASE_STORAGE_BUCKET!
const folder = 'samples/'

const VideoListPage: React.FC = () => {
    const [videos, setVideos] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchVideos = async () => {
            setLoading(true)
            const { data, error } = await supabase.storage.from(bucket).list(folder)
            if (!error && data) {
                setVideos(data.map((item) => item.name))
            }
            setLoading(false)
        }

        fetchVideos()
    }, [])

    const handleDelete = async (filename: string) => {
        const { error } = await supabase.storage.from(bucket).remove([`${folder}${filename}`])
        if (!error) {
            setVideos((prev) => prev.filter((f) => f !== filename))
        } else {
            alert('Xoá thất bại: ' + error.message)
        }
    }

    return (
        <div style={{ padding: '2rem' }}>
            <h2>📁 Danh sách video mẫu đã tải lên</h2>
            {loading ? <p>Đang tải...</p> : null}
            <ul>
                {videos.map((filename) => (
                    <li key={filename} style={{ marginBottom: '1rem' }}>
                        <video
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${folder}${filename}`}
                            controls
                            style={{ width: '300px', marginBottom: '0.5rem' }}
                        />
                        <br />
                        <button onClick={() => handleDelete(filename)}>❌ Xoá</button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default VideoListPage
