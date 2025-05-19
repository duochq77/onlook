import React, { useEffect, useRef, useState } from 'react';
import { connect, Room, LocalTrackPublication, LocalVideoTrack, LocalAudioTrack, createLocalVideoTrack } from 'livekit-client';
import { connectToRoom } from '@/services/LiveKitService';
import { supabase } from '@/services/SupabaseService';

const WebcamAudioFilePage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const [audioUrl, setAudioUrl] = useState<string>('');
    const [audioElement] = useState<HTMLAudioElement>(new Audio());
    const [useSampleAudio, setUseSampleAudio] = useState<boolean>(false);

    useEffect(() => {
        const startStream = async () => {
            const roomName = 'default-room';
            const identity = 'seller-webcam-audiofile';
            const role = 'publisher';

            const room = await connectToRoom(roomName, identity, role);
            setRoom(room);

            const videoTrack = await createLocalVideoTrack();
            room.localParticipant.publishTrack(videoTrack);
            videoTrack.attach(videoRef.current!);

            let audioTrack: LocalAudioTrack | null = null;
            if (useSampleAudio) {
                const { data, error } = await supabase
                    .storage
                    .from('uploads')
                    .download('sample-audio.mp3');

                if (data) {
                    const url = URL.createObjectURL(data);
                    audioElement.src = url;
                    audioElement.loop = true;
                    audioElement.play();

                    const stream = audioElement.captureStream();
                    const audioMediaTrack = stream.getAudioTracks()[0];
                    audioTrack = new LocalAudioTrack(audioMediaTrack);
                    room.localParticipant.publishTrack(audioTrack);
                }
            } else {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const micTrack = stream.getAudioTracks()[0];
                audioTrack = new LocalAudioTrack(micTrack);
                room.localParticipant.publishTrack(audioTrack);
            }
        };

        startStream();

        return () => {
            audioElement.pause();
            audioElement.src = '';
            room?.disconnect();
        };
    }, [useSampleAudio]);

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
    );
};

export default WebcamAudioFilePage;
