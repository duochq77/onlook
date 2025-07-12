import React from 'react'
import { useRouter } from 'next/router'
import { ArrowRight } from 'lucide-react'

const modes = [
    {
        name: 'Phương thức 1: Webcam + Mic',
        path: '/seller/webcamMic',
        description: 'Phát trực tiếp cả video và âm thanh từ thiết bị.'
    },
    {
        name: 'Phương thức 2: Webcam + Audio File/Mẫu',
        path: '/seller/webcamAudioFile',
        description: 'Phát video từ webcam, nhưng dùng âm thanh từ file hoặc kho mẫu.'
    },
    {
        name: 'Phương thức 3: Video File + Audio File/Mẫu',
        path: '/seller/videoAudioFile',
        description: 'Phát video từ file có sẵn, kết hợp âm thanh từ nguồn khác.'
    },
    {
        name: 'Phương thức 4: Video Đã Ghép Sẵn',
        path: '/seller/videoSingleFile',
        description: 'Phát video đã có sẵn cả hình và tiếng trong một file duy nhất.'
    }
]

const SelectStreamMode: React.FC = () => {
    const router = useRouter()

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-gray-100 flex flex-col items-center justify-center px-4 py-12">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-8">
                🎛️ Chọn hình thức livestream
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {modes.map((mode, index) => (
                    <div
                        key={index}
                        onClick={() => router.push(mode.path)}
                        className="cursor-pointer rounded-2xl p-6 bg-white border border-gray-200 shadow-md hover:shadow-xl transition-transform hover:-translate-y-1"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xl font-semibold text-gray-800">{mode.name}</h2>
                            <ArrowRight className="text-gray-500 w-5 h-5" />
                        </div>
                        <p className="text-gray-600">{mode.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default SelectStreamMode
