// 08. src/components/SellerForm.tsx

import React, { useState } from 'react'
import ProductInfoBox from './ProductInfoBox'
import FileUploader from './FileUploader'
import Player from './Player'

interface SellerFormProps {
    mode: 'video-audio' | 'file-only' | 'webcam' | 'webcam-audio'
    onSubmit: (formData: {
        productName: string
        link: string
        videoUrl?: string
        audioUrl?: string
    }) => void
}

const SellerForm: React.FC<SellerFormProps> = ({ mode, onSubmit }) => {
    const [productName, setProductName] = useState('')
    const [link, setLink] = useState('')
    const [videoUrl, setVideoUrl] = useState('')
    const [audioUrl, setAudioUrl] = useState('')

    const handleSubmit = () => {
        if (!productName) {
            alert('Vui lòng nhập tên sản phẩm')
            return
        }
        if ((mode === 'file-only' || mode === 'video-audio') && !videoUrl) {
            alert('Vui lòng upload video')
            return
        }
        if ((mode === 'video-audio' || mode === 'webcam-audio') && !audioUrl) {
            alert('Vui lòng upload audio')
            return
        }
        onSubmit({ productName, link, videoUrl, audioUrl })
    }

    return (
        <div className="space-y-6">
            <ProductInfoBox
                productName={productName}
                setProductName={setProductName}
                link={link}
                setLink={setLink}
            />

            {(mode === 'file-only' || mode === 'video-audio') && (
                <>
                    <FileUploader
                        label="🎥 Video sản phẩm (.mp4)"
                        accept="video/mp4"
                        folder="videos"
                        onUploadComplete={setVideoUrl}
                    />
                    <Player fileUrl={videoUrl} type="video" />
                </>
            )}

            {(mode === 'video-audio' || mode === 'webcam-audio') && (
                <>
                    <FileUploader
                        label="🎧 File âm thanh giới thiệu (.mp3)"
                        accept="audio/mpeg"
                        folder="audios"
                        onUploadComplete={setAudioUrl}
                    />
                    <Player fileUrl={audioUrl} type="audio" />
                </>
            )}

            <button
                onClick={handleSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
                Bắt đầu livestream
            </button>
        </div>
    )
}

export default SellerForm
