/**
 * Các hình thức livestream hỗ trợ trong hệ thống Onlook
 */
export var StreamMode;
(function (StreamMode) {
    StreamMode["WebcamOnly"] = "webcam-only";
    StreamMode["WebcamWithAudioFile"] = "webcam-audio";
    StreamMode["VideoWithAudioFile"] = "video-audio";
    StreamMode["FullVideo"] = "video-full";
})(StreamMode || (StreamMode = {}));
