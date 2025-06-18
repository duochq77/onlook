import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import ffmpeg from 'fluent-ffmpeg'
import ffprobePath from 'ffprobe-static'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'

ffmpeg.setFfmpegPath(ffmpegPath!)
ffmpeg.setFfprobePath(ffprobePath.path)

// 🔐 ENV
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET!
const redisUrl = process.env.UPSTASH_REDIS_REST_URL!
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const redis = new Redis({ url: redisUrl, token: redisToken })

const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err)
            resolve(metadata.format.duration || 0)
        })
    })
}

const downloadFile = async (url: string, dest: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Download failed: ' + url)
    const fileStream = fs.createWriteStream(dest)
    await new Promise((resolve, reject) => {
        if (!res.body) return reject('No body')
        res.body.pipe(fileStream)
        res.body.on('error', reject)
        fileStream.on('finish', resolve)
    })
}

const loopMedia = (input: string, output: string, minDuration: number): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const inputDuration = await getDuration(input)
        const loopCount = Math.ceil(minDuration / inputDuration)
        const inputs = Array(loopCount).fill(`-i ${input}`).join(' ')
        const filter = Array(loopCount).fill('[0:v:0]').join('') + `concat=n=${loopCount}:v=1:a=0[outv]`
        const cmd = `ffmpeg ${inputs} -filter_complex "${filter}" -map "[outv]" -y ${output}`
        require('child_process').exec(cmd, (err: any) => {
            if (err) return reject(err)
            resolve()
        })
    })
}

const cutMedia = (input: string, output: string, duration: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(input)
            .outputOptions(['-t', duration.toFixed(2)])
            .save(output)
            .on('end', () => resolve())
            .on('error', reject)
    })
}

const processJob = async (job: any) => {
    const tmpDir = path.join(os.tmpdir(), `onlook-job-${job.jobId}`)
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.mkdirSync(tmpDir)

    const inputVideo = path.join(tmpDir, 'input.mp4')
    const inputAudio = path.join(tmpDir, 'input.mp3')
    const cleanVideo = path.join(tmpDir, 'clean.mp4')
    const finalVideo = path.join(tmpDir, 'final.mp4')
    const finalAudio = path.join(tmpDir, 'final.mp3')
    const mergedOutput = path.join(tmpDir, 'output.mp4')

    try {
        console.log('📥 Đang tải video và audio về RAM...')
        await downloadFile(job.videoUrl, inputVideo)
        await downloadFile(job.audioUrl, inputAudio)

        console.log('✂️ Tách audio khỏi video gốc...')
        await new Promise((resolve, reject) => {
            ffmpeg().input(inputVideo).noAudio().save(cleanVideo).on('end', resolve).on('error', reject)
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)

        console.log(`📊 Durations: video = ${videoDur}s, audio = ${audioDur}s`)

        if (Math.abs(videoDur - audioDur) < 1) {
            fs.copyFileSync(cleanVideo, finalVideo)
            fs.copyFileSync(inputAudio, finalAudio)
        } else if (videoDur < audioDur) {
            await loopMedia(cleanVideo, finalVideo, audioDur)
            await cutMedia(finalVideo, finalVideo, audioDur)
            fs.copyFileSync(inputAudio, finalAudio)
        } else if (videoDur > audioDur && videoDur / audioDur < 1.2) {
            await cutMedia(cleanVideo, finalVideo, audioDur)
            fs.copyFileSync(inputAudio, finalAudio)
        } else {
            fs.copyFileSync(cleanVideo, finalVideo)
            await loopMedia(inputAudio, finalAudio, videoDur)
            await cutMedia(finalAudio, finalAudio, videoDur)
        }

        console.log('🎞 Ghép video và audio lại...')
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(finalVideo)
                .input(finalAudio)
                .outputOptions('-c:v copy', '-c:a aac', '-shortest')
                .save(mergedOutput)
                .on('end', resolve)
                .on('error', reject)
        })

        const buffer = fs.readFileSync(mergedOutput)
        const outputPath = `outputs/${job.outputName}`

        console.log('☁️ Upload lên Supabase:', outputPath)
        await supabase.storage.from(supabaseStorageBucket).upload(outputPath, buffer, {
            upsert: true,
            contentType: 'video/mp4',
        })

        console.log('🧹 Xoá nguyên liệu đầu vào...')
        await supabase.storage.from(supabaseStorageBucket).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`,
        ])
    } catch (err) {
        console.error('❌ Worker lỗi:', err)
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
}

// 🔁 Worker nền – rút job từ Redis tự động
const startWorker = async () => {
    console.log('🚀 Worker nền đang chạy...')

    while (true) {
        try {
            const jobStr = await redis.lpop('onlook:job-queue')
            if (jobStr) {
                const job = JSON.parse(jobStr)
                console.log('📦 Nhận job:', job.jobId)
                await processJob(job)
            } else {
                await new Promise(r => setTimeout(r, 3000))
            }
        } catch (err) {
            console.error('❌ Lỗi khi xử lý job:', err)
        }
    }
}

startWorker()
