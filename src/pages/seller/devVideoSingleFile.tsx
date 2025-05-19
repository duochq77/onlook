import React, { useEffect, useRef } from 'react'
import { Room } from 'livekit-client/dist/room'
import { LocalVideoTrack } from 'livekit-client'

const DevVideoSingleFile: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        const connectToRoom = async () => {
            const token = 'YOUR_TOKEN_HERE' // ⚠️ Thay bằng token thật
            const serverUrl = 'wss://onlook-jvtj33oo.livekit.cloud'

            const room = new Room()
            await room.connect(serverUrl, token, {
                autoSubscribe: true,
            })

            const videoTrack = await LocalVideoTrack.create()
            await room.localParticipant.publishTrack(videoTrack)

            if (videoRef.current) {
                const stream = new MediaStream([videoTrack.mediaStreamTrack])
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
        }

        connectToRoom()

        return () => {
            videoRef.current?.pause()
        }
    }, [])

    return (
        <div>
            <h1>LiveKit 2.13.0 – Video Only (fixed)</h1>
            <video ref={videoRef} autoPlay muted playsInline width="100%" />
        </div>
    )
}

export default DevVideoSingleFile
