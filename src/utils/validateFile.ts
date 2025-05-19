// src/utils/validateFile.ts
// File số 9 – Dùng để kiểm tra định dạng và dung lượng file trước khi upload

/**
 * Kiểm tra xem file có nằm trong danh sách định dạng cho phép không
 * @param file - File người dùng chọn
 * @param allowedTypes - Mảng các định dạng MIME hợp lệ (ví dụ: ['video/mp4', 'audio/mpeg'])
 * @returns true nếu hợp lệ, ngược lại false
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type)
}

/**
 * Kiểm tra dung lượng file có nhỏ hơn giới hạn cho phép không
 * @param file - File người dùng chọn
 * @param maxSizeMB - Dung lượng tối đa cho phép tính theo MB (ví dụ: 100)
 * @returns true nếu file nhỏ hơn hoặc bằng giới hạn, ngược lại false
 */
export function validateFileSize(file: File, maxSizeMB: number): boolean {
    const sizeInMB = file.size / (1024 * 1024)
    return sizeInMB <= maxSizeMB
}
