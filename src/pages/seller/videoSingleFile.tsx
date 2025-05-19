import React, { useEffect, useRef } from 'react'
import { connect } from 'livekit-client/dist/es5/connect'
import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client'
import { Room } from 'livekit-client/dist/es5/room' // ✅ Import đúng module Room

const SellerVideoSingleFilePage: React.FC = () => {
    const videoContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const startLivestream = async () => {
            const res = await fetch(`/api/token?room=onlook-room&identity=seller-file&role=publisher`)
            const { token } = await res.json()

            const room = new Room()
            await connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, { room })

            // Load file video từ thư mục public
            const videoEl = document.createElement('video')
            videoEl.src = '/full-video.mp4'
            videoEl.loop = true
            videoEl.muted = true
            await videoEl.play()

            const stream = videoEl.captureStream()
            const videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0])
            const audioTrack = new LocalAudioTrack(stream.getAudioTracks()[0])

            await room.localParticipant.publishTrack(videoTrack)
            await room.localParticipant.publishTrack(audioTrack)

            const attached = videoTrack.attach()
            videoContainerRef.current?.appendChild(attached)
        }

        startLivestream()
        return () => { }
    }, [])

    return (
        <div>
            <h2>🔴 Test phát file video có sẵn</h2>
            <div ref={videoContainerRef} />
        </div>
    )
}

export default SellerVideoSingleFilePage
