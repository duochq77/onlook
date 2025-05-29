import React from 'react';
import Link from 'next/link';
const HomePage = () => {
    return (<main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
            <h1 className="text-4xl font-bold mb-4">Chào mừng đến với Onlook 🎥</h1>
            <p className="mb-6 text-lg text-gray-700">
                Nền tảng bán hàng livestream định vị, phục vụ hàng triệu người!
            </p>
            <div className="space-x-4">
                <Link href="/seller/webcam" className="bg-blue-500 text-white px-4 py-2 rounded-xl shadow">
                    Bắt đầu Livestream
                </Link>
                <Link href="/viewer/default-room" className="bg-green-500 text-white px-4 py-2 rounded-xl shadow">
                    Xem Livestream
                </Link>
                <Link href="/admin" className="bg-gray-700 text-white px-4 py-2 rounded-xl shadow">
                    Trang Admin
                </Link>
                <Link href="/seller/VideoAudioFile" className="bg-purple-500 text-white px-4 py-2 rounded-xl shadow">
                    Test VideoAudioFile
                </Link>
            </div>
        </main>);
};
export default HomePage;
