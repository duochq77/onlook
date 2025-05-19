/**
 * Kiểm tra file có phải định dạng video .mp4 không
 */
export function isMP4(filename: string): boolean {
    return filename.toLowerCase().endsWith('.mp4')
}

/**
 * Kiểm tra file có phải định dạng audio .mp3 không
 */
export function isMP3(filename: string): boolean {
    return filename.toLowerCase().endsWith('.mp3')
}

/**
 * Ước tính thời lượng video nếu có metadata (tùy vào cách dùng URL hoặc HTMLMediaElement)
 */
export async function getVideoDuration(fileUrl: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.src = fileUrl
        video.preload = 'metadata'

        video.onloadedmetadata = () => {
            resolve(video.duration)
        }

        video.onerror = () => {
            reject(new Error('Không thể lấy metadata video'))
        }
    })
}
