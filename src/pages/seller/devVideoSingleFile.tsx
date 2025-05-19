import React, { useEffect, useRef, useState } from 'react'
import { connect, Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client'

const DevVideoSingleFile: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<Room | null>(null)

    useEffect(() => {
        const connectToRoom = async () => {
            const token = 'YOUR_TOKEN_HERE' // thay bằng token thật
            const url = 'wss://onlook-jvtj33oo.livekit.cloud'

            const room = await connect(url, token, {
                audio: false,
                video: false,
            })

            const videoTrack = await LocalVideoTrack.create()
            room.localParticipant.publishTrack(videoTrack)

            const mediaStream = new MediaStream([videoTrack.mediaStreamTrack])
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
                videoRef.current.play()
            }

            setRoom(room)
        }

        connectToRoom()

        return () => {
            room?.disconnect()
        }
    }, [])

    return (
        <div>
            <h1>Test LiveKit 0.13.1 – Single Video</h1>
            <video ref={videoRef} autoPlay muted playsInline width="100%" />
        </div>
    )
}

export default DevVideoSingleFile
