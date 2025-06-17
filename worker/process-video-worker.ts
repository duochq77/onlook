import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import ffmpeg from 'fluent-ffmpeg'
import ffprobePath from 'ffprobe-static'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'
import path from 'path'
import os from 'os'
import express from 'express'
import fetch from 'node-fetch'
import { exec } from 'child_process'

ffmpeg.setFfmpegPath(ffmpegPath!)
ffmpeg.setFfprobePath(ffprobePath.path)

const app = express()
app.use(express.json())
const PORT = process.env.PORT || 8080

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
    await new Promise<void>((resolve, reject) => {
        if (!res.body) return reject('No body')
        res.body.pipe(fileStream)
        res.body.on('error', reject)
        fileStream.on('finish', () => resolve())
    })
}

const loopMedia = (input: string, output: string, minDuration: number): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const inputDuration = await getDuration(input)
        const loopCount = Math.ceil(minDuration / inputDuration)
        const inputs = Array(loopCount).fill(`-i ${input}`).join(' ')
        const filter = Array(loopCount).fill('[0:v:0]').join('') + `concat=n=${loopCount}:v=1:a=0[outv]`

        const cmd = `ffmpeg ${inputs} -filter_complex "${filter}" -map "[outv]" -y ${output}`
        exec(cmd, (err) => {
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

app.post('/', async (req, res) => {
    res.status(200).json({ ok: true })
    const job = req.body

    const tmpDir = path.join(os.tmpdir(), `onlook-job-${job.jobId}`)
    fs.rmSync(tmpDir, { force: true, recursive: true })
    fs.mkdirSync(tmpDir)

    const inputVideo = path.join(tmpDir, 'input.mp4')
    const inputAudio = path.join(tmpDir, 'input.mp3')
    const cleanVideo = path.join(tmpDir, 'clean.mp4')
    const finalVideo = path.join(tmpDir, 'final.mp4')
    const finalAudio = path.join(tmpDir, 'final.mp3')
    const mergedOutput = path.join(tmpDir, 'output.mp4')

    try {
        await downloadFile(job.videoUrl, inputVideo)
        await downloadFile(job.audioUrl, inputAudio)

        // Tách video sạch không audio
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(inputVideo)
                .noAudio()
                .save(cleanVideo)
                .on('end', () => resolve())
                .on('error', reject)
        })

        const videoDur = await getDuration(cleanVideo)
        const audioDur = await getDuration(inputAudio)

        // Cân bằng độ dài
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

        if (fs.existsSync(mergedOutput)) fs.unlinkSync(mergedOutput)

        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(finalVideo)
                .input(finalAudio)
                .outputOptions('-c:v copy', '-c:a aac', '-shortest')
                .save(mergedOutput)
                .on('end', () => resolve())
                .on('error', reject)
        })

        const buffer = fs.readFileSync(mergedOutput)
        await supabase.storage
            .from(supabaseStorageBucket)
            .upload(`outputs/${job.outputName}`, buffer, {
                upsert: true,
                contentType: 'video/mp4',
            })

        await supabase.storage.from(supabaseStorageBucket).remove([
            `input-videos/input-${job.jobId}.mp4`,
            `input-audios/input-${job.jobId}.mp3`,
        ])
    } catch (err) {
        console.error('❌ Worker lỗi:', err)
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Worker chạy tại cổng ${PORT}`)
})
