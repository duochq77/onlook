import { Redis } from '@upstash/redis'

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Thêm job vào hàng đợi xử lý FFmpeg
 */
export async function pushFFmpegJob(job: object) {
    await redis.rpush('ffmpeg-jobs', JSON.stringify(job))
}

/**
 * Lấy job ra khỏi hàng đợi
 */
export async function popFFmpegJob(): Promise<any | null> {
    const jobStr = await redis.lpop<string>('ffmpeg-jobs') // ✅ ép kiểu rõ ràng
    if (!jobStr) return null
    return JSON.parse(jobStr)
}
