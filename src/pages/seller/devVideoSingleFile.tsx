import React, { useEffect, useRef } from 'react'
import {
    createLocalVideoTrack,
    createRoom,
    type LocalVideoTrack,
} from 'livekit-client'

const DevVideoSingleFile: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        const connectToRoom = async () => {
            const token = 'YOUR_TOKEN_HERE' // ⚠️ thay bằng token thật sự
            const serverUrl = 'wss://onlook-jvtj33oo.livekit.cloud'

            const room = createRoom()
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
        }

        connectToRoom()

        return () => {
            // Disconnect room nếu tồn tại
            videoRef.current?.pause()
        }
    }, [])

    return (
        <div>
            <h1>LiveKit 2.13.0 – Video Only</h1>
            <video ref={videoRef} autoPlay muted playsInline width="100%" />
        </div>
    )
}

export default DevVideoSingleFile
