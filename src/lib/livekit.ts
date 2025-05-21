export const getLiveKitDeps = () => {
    const Room = require('livekit-client/dist/room').Room;
    const {
        LocalVideoTrack,
        LocalAudioTrack,
        createLocalVideoTrack,
        createLocalAudioTrack
    } = require('livekit-client/dist/webrtc');

    return {
        Room,
        LocalVideoTrack,
        LocalAudioTrack,
        createLocalVideoTrack,
        createLocalAudioTrack
    };
};
