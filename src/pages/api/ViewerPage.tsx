// @ts-ignore
import {
    Room,
    RemoteTrackPublication,
    RemoteVideoTrack,
    RemoteParticipant,
    Track,
    connect
} from 'livekit-client'

const ViewerPage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [room, setRoom] = useState<Room | null>(null)

    useEffect(() => {
        const connectToRoom = async () => {
            const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''
            const roomName = 'default-room'
            const identity = 'viewer-' + Math.floor(Math.random() * 10000)

            const res = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=subscriber`)
            const data = await res.json()
            const token = data.token

            const room = await connect(serverUrl, token, { autoSubscribe: true })
            setRoom(room)

            room.on(
                'trackSubscribed',
                (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
                    if (track.kind === 'video' && videoRef.current) {
                        (track as RemoteVideoTrack).attach(videoRef.current)
                    }
                }
            )

            room.on('disconnected', () => {
                console.log('🚪 Viewer disconnected')
                setRoom(null)
            })
        }

        connectToRoom()

        return () => {
            if (room) room.disconnect()
        }
    }, [])

    return (
        <div style={{ padding: 24 }}>
            <h1>👀 Giao diện người xem livestream</h1>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                controls={false}
                style={{ width: '100%', maxWidth: 600, borderRadius: 12 }}
            />
        </div>
    )
}

export default ViewerPage
