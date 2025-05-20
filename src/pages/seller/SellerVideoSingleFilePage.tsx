import React, { useEffect, useRef } from 'react'

// @ts-ignore – không có types chính thức cho Room
const { Room } = require('livekit-client/dist/room')
// @ts-ignore – không có types chính thức cho các Track
const { LocalVideoTrack, LocalAudioTrack } = require('livekit-client/dist/webrtc')

const SellerVideoSingleFilePage: React.FC = () => {
  const videoContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const startLivestream = async () => {
      const res = await fetch(`/api/token?room=onlook-room&identity=seller-file&role=publisher`)
      const { token } = await res.json()

      const room = new Room()
      await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
        autoSubscribe: false,
      })

      // Tạo video element từ file public
      const videoEl = document.createElement('video')
      videoEl.src = '/full-video.mp4'
      videoEl.loop = true
      videoEl.muted = true
      videoEl.playsInline = true

      await videoEl.play()

      // Capture stream và tạo track video/audio
      const stream = videoEl.captureStream()
      const [videoTrackRaw] = stream.getVideoTracks()
      const [audioTrackRaw] = stream.getAudioTracks()

      const videoTrack = new LocalVideoTrack(videoTrackRaw)
      const audioTrack = new LocalAudioTrack(audioTrackRaw)

      await room.localParticipant.publishTrack(videoTrack)
      await room.localParticipant.publishTrack(audioTrack)

      // Gắn preview ra UI
      const attached = videoTrack.attach()
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = ''
        videoContainerRef.current.appendChild(attached)
      }
    }

    startLivestream()

    return () => {
      // TODO: xử lý room.disconnect() nếu cần
    }
  }, [])

  return (
    <div>
      <h2>🔴 Test phát file video có sẵn</h2>
      <div ref={videoContainerRef} />
    </div>
  )
}

export default SellerVideoSingleFilePage
