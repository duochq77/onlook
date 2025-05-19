import React, { useEffect, useRef, useState } from 'react'
import {
    Room,
    LocalVideoTrack,
    createLocalVideoTrack,
} from 'livekit-client'

const DevVideoSingleFile: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<Room | null>(null)

    useEffect(() => {
        const connectToRoom = async () => {
            const token = 'YOUR_TOKEN_HERE' // ⚠️ thay bằng token thật sự
            const serverUrl = 'wss://onlook-jvtj33oo.livekit.cloud'

            const room = new Room()
            await room.connect(serverUrl, token, {
                autoSubscribe: true,
            })

            const videoTrack: LocalVideoTrack = await createLocalVideoTrack()
            await room.localParticipant.publishTrack(videoTrack)

            if (videoRef.current) {
                const stream = new MediaStream([videoTrack.mediaStreamTrack])
                videoRef.current.srcObject = stream
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
            <h1>Test LiveKit 2.13.0 – Video Only</h1>
            <video ref={videoRef} autoPlay muted playsInline width="100%" />
        </div>
    )
}

export default DevVideoSingleFile
