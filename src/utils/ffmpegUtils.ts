/**
 * Tạo câu lệnh FFmpeg để ghép file video và audio
 * Dùng cho worker hoặc xử lý local
 */
export function generateFFmpegCommand(inputVideo: string, inputAudio: string, outputPath: string): string {
    return `ffmpeg -i ${inputVideo} -i ${inputAudio} -c:v copy -c:a aac -shortest ${outputPath}`
}
