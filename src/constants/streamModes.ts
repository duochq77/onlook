/**
 * Các hình thức livestream hỗ trợ trong hệ thống Onlook
 */
export enum StreamMode {
    WebcamOnly = 'webcam-only',               // Livestream trực tiếp webcam + micro
    WebcamWithAudioFile = 'webcam-audio',     // Webcam realtime + audio từ file (.mp3)
    VideoWithAudioFile = 'video-audio',       // Video file (.mp4) + audio file (.mp3)
    FullVideo = 'video-full',                 // Video có sẵn đã ghép cả hình + tiếng
}
