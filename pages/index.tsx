import React from 'react'
import Link from 'next/link'

const HomePage: React.FC = () => {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-white text-center px-4">
            <h1 className="text-5xl font-extrabold mb-6 text-black">🎥 Onlook</h1>
            <p className="mb-8 text-lg text-gray-700 max-w-xl">
                Nền tảng bán hàng livestream tại địa điểm thực tế – xem lướt kiểu TikTok, không giới hạn người xem, tích hợp thanh toán thông minh và ví nội bộ!
            </p>

            <div className="space-y-4 w-full max-w-sm">
                <Link
                    href="/seller/webcam"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-lg font-medium shadow"
                >
                    🚀 Bắt đầu Livestream (Webcam)
                </Link>

                <Link
                    href="/viewer"
                    className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-lg font-medium shadow"
                >
                    📺 Xem Livestream Kiểu TikTok
                </Link>

                <Link
                    href="/admin"
                    className="block w-full bg-gray-800 hover:bg-gray-900 text-white py-3 rounded-xl text-lg font-medium shadow"
                >
                    🛠️ Trang Admin
                </Link>

                <Link
                    href="/seller/VideoAudioFile"
                    className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-lg font-medium shadow"
                >
                    🎬 Test Ghép Video + Audio
                </Link>
            </div>
        </main>
    )
}

export default HomePage
