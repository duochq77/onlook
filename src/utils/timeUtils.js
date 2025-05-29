/**
 * Kiểm tra một timestamp có cũ hơn N phút so với hiện tại hay không
 * @param timestamp ISO string hoặc Date object
 * @param minutes số phút cần kiểm tra
 */
export function isOlderThan(timestamp, minutes) {
    const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime();
    const now = Date.now();
    return now - time > minutes * 60 * 1000;
}
/**
 * Định dạng lại thời gian về dạng HH:MM:SS
 * @param ms số mili giây
 */
export function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
        .map((v) => v.toString().padStart(2, '0'))
        .join(':');
}
