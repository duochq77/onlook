import React from 'react';
import { useRouter } from 'next/router';
const modes = [
    {
        name: 'Phương thức 1: Webcam + Mic',
        path: '/seller/webcamMic',
        description: 'Phát trực tiếp cả video và âm thanh từ thiết bị.'
    },
    {
        name: 'Phương thức 2: Webcam + Audio File/Mẫu',
        path: '/seller/webcamAudioFile',
        description: 'Phát video trực tiếp từ webcam, nhưng dùng audio từ file hoặc kho mẫu.'
    },
    {
        name: 'Phương thức 3: Video File + Audio File/Mẫu',
        path: '/seller/videoAudioFile',
        description: 'Phát video từ file trên thiết bị, âm thanh từ file khác hoặc kho mẫu.'
    },
    {
        name: 'Phương thức 4: Video Đã Ghép Sẵn',
        path: '/seller/videoSingleFile',
        description: 'Phát video đã có cả hình và tiếng, từ một file duy nhất.'
    }
];
const SelectStreamMode = () => {
    const router = useRouter();
    return (<div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-bold mb-6">Chọn hình thức livestream</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
                {modes.map((mode, index) => (<div key={index} onClick={() => router.push(mode.path)} className="cursor-pointer border border-gray-300 rounded-2xl p-4 shadow hover:shadow-lg transition">
                        <h2 className="text-lg font-semibold mb-2">{mode.name}</h2>
                        <p className="text-gray-600">{mode.description}</p>
                    </div>))}
            </div>
        </div>);
};
export default SelectStreamMode;
