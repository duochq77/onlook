export const dynamic = 'force-dynamic' // Ngăn lỗi Audio khi prerender trên server

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/services/SupabaseService'
const livekit = require('livekit-client')

const WebcamAudioFilePage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<any>(null)
    const [useSampleAudio, setUseSampleAudio] = useState<boolean>(false)

    useEffect(() => {
        let audioElement: HTMLAudioElement | null = null

        const startStream = async () => {
            const roomName = 'default-room'
            const identity = 'seller-webcam-audiofile-' + Math.floor(Math.random() * 10000)
            const role = 'publisher'

            const room = new livekit.Room()
            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`)
            const { token } = await res.json()
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token)
            setRoom(room)

            const videoTrack = await livekit.createLocalVideoTrack()
            await room.localParticipant.publishTrack(videoTrack)
            videoTrack.attach(videoRef.current!)

            let audioTrack: any = null
            if (useSampleAudio) {
                const { data } = await supabase.storage.from('uploads').download('sample-audio.mp3')
                if (data) {
                    const url = URL.createObjectURL(data)
                    audioElement = new Audio(url)
                    audioElement.loop = true
                    await audioElement.play()

                    const audioEl = audioElement as any
                    const stream =
                        (typeof audioEl.captureStream === 'function' ? audioEl.captureStream() : null) ||
                        (typeof audioEl.mozCaptureStream === 'function' ? audioEl.mozCaptureStream() : null)

                    if (stream) {
                        const audioMediaTrack = stream.getAudioTracks()[0]
                        audioTrack = new livekit.LocalAudioTrack(audioMediaTrack)
                        await room.localParticipant.publishTrack(audioTrack)
                    }
                }
            } else {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                const micTrack = stream.getAudioTracks()[0]
                audioTrack = new livekit.LocalAudioTrack(micTrack)
                await room.localParticipant.publishTrack(audioTrack)
            }
        }

        startStream()

        return () => {
            if (audioElement) {
                audioElement.pause()
                audioElement.src = ''
            }
            room?.disconnect()
        }
    }, [useSampleAudio])

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-2xl font-bold mb-4">Phát webcam + audio từ mic hoặc mẫu</h1>
            <video ref={videoRef} autoPlay muted className="w-full max-w-xl rounded-lg shadow" />
            <div className="mt-4">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={useSampleAudio}
                        onChange={(e) => setUseSampleAudio(e.target.checked)}
                    />
                    <span>Dùng audio mẫu từ kho AI (Supabase)</span>
                </label>
            </div>
        </div>
    )
}

export default WebcamAudioFilePage
