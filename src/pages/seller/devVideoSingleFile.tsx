// src/pages/seller/devVideoSingleFile.tsx

import React, { useEffect, useRef, useState } from 'react'
import { Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client'
import { connect } from 'livekit-client/dist/connect'

const DevVideoSingleFilePage: React.FC = () => {
    const videoContainerRef = useRef<HTMLDivElement>(null)
    const [room, setRoom] = useState<Room | null>(null)

    useEffect(() => {
        const startLivestream = async () => {
            const res = await fetch(`/api/token?room=onlook-room&identity=seller-dev&role=publisher`)
            const { token } = await res.json()

            const room = await connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
            setRoom(room)

            const videoEl = document.createElement('video')
            videoEl.src = '/full-video.mp4'
            videoEl.loop = true
            videoEl.muted = true
            await videoEl.play()

            const stream = videoEl.captureStream()
            const videoTrack = stream.getVideoTracks()[0]
            const audioTrack = stream.getAudioTracks()[0]

            if (videoTrack) {
                const localVideoTrack = new LocalVideoTrack(videoTrack)
                await room.localParticipant.publishTrack(localVideoTrack)
                const attached = localVideoTrack.attach()
                videoContainerRef.current?.appendChild(attached)
            }

            if (audioTrack) {
                const localAudioTrack = new LocalAudioTrack(audioTrack)
                await room.localParticipant.publishTrack(localAudioTrack)
            }
        }

        startLivestream()

        return () => {
            room?.disconnect()
        }
    }, [])

    return (
        <div>
            <h2>🔁 Test Dev Video (devVideoSingleFile.tsx)</h2>
            <div ref={videoContainerRef} />
        </div>
    )
}

export default DevVideoSingleFilePage
