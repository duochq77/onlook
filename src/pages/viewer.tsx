import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ViewerPage() {
    const [videos, setVideos] = useState<string[]>([])
    const [selected, setSelected] = useState<string | null>(null)

    useEffect(() => {
        fetchVideos()
    }, [])

    async function fetchVideos() {
        const { data, error } = await supabase
            .storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .list('outputs', { limit: 100 })

        if (error) {
            console.error('❌ Lỗi tải danh sách video:', error)
            return
        }

        const urls = data
            .filter(file => file.name.endsWith('.mp4'))
            .map(file => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/outputs/${file.name}`)

        setVideos(urls)
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">📺 Viewer Page</h1>

            {selected ? (
                <div className="mb-6">
                    <video src={selected} controls autoPlay className="w-full max-w-3xl mx-auto rounded" />
                    <button
                        className="mt-4 text-blue-600 underline"
                        onClick={() => setSelected(null)}
                    >
                        ← Quay lại danh sách
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {videos.map((url, idx) => (
                        <div key={idx} className="cursor-pointer" onClick={() => setSelected(url)}>
                            <video src={url} muted className="w-full rounded" />
                            <p className="text-sm mt-1 truncate">{url.split('/').pop()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
