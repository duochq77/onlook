import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/services/SupabaseService'
import { Room, LocalVideoTrack, LocalAudioTrack, createLocalVideoTrack } from '@livekit/components-core'

const WebcamAudioFilePage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<Room | null>(null)
    const [audioElement] = useState<HTMLAudioElement>(new Audio())
    const [useSampleAudio, setUseSampleAudio] = useState<boolean>(false)

    useEffect(() => {
        const startStream = async () => {
            const roomName = 'default-room'
            const identity = 'seller-webcam-audiofile-' + Math.floor(Math.random() * 10000)
            const role = 'publisher'

            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`)
            const { token } = await res.json()

            const room = new Room()
            await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            setRoom(room)

            const videoTrack = await createLocalVideoTrack()
            await room.localParticipant.publishTrack(videoTrack)
            videoTrack.attach(videoRef.current!)

            let audioTrack: LocalAudioTrack | null = null
            if (useSampleAudio) {
                const { data } = await supabase.storage.from('uploads').download('sample-audio.mp3')
                if (data) {
                    const url = URL.createObjectURL(data)
                    audioElement.src = url
                    audioElement.loop = true
                    await audioElement.play()
                    const stream = (audioElement as any).captureStream()
                    const track = stream.getAudioTracks()[0]
                    audioTrack = new LocalAudioTrack(track)
                    await room.localParticipant.publishTrack(audioTrack)
                }
            } else {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                const track = stream.getAudioTracks()[0]
                audioTrack = new LocalAudioTrack(track)
                await room.localParticipant.publishTrack(audioTrack)
            }
        }

        startStream()
        return () => {
            audioElement.pause()
            audioElement.src = ''
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
                    <span>Dùng audio mẫu từ Supabase</span>
                </label>
            </div>
        </div>
    )
}

export default WebcamAudioFilePage
