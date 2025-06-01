import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function runMergeWorker() {
    console.log('🎬 Merge Video Worker bắt đầu...')

    while (true) {
        const job = await redis.lpop<string>('ffmpeg-jobs:merge')
        if (!job) {
            await new Promise((r) => setTimeout(r, 2000))
            continue
        }

        const { cleanVideo, audio, outputName } = JSON.parse(job)
        console.log('📦 Nhận job MERGE:', { cleanVideo, audio, outputName })

        const tmpCleanVideo = path.join('/tmp', 'clean-video.mp4')
        const tmpAudio = path.join('/tmp', 'audio.mp3')
        const tmpOutput = path.join('/tmp', outputName)

        // 1. Tải cleanVideo từ Supabase về RAM
        const { data: cleanVideoData, error: err1 } = await supabase.storage
            .from('stream-files')
            .download(cleanVideo)
        if (err1 || !cleanVideoData) {
            console.error('❌ Không tải được cleanVideo:', err1)
            continue
        }
        fs.writeFileSync(tmpCleanVideo, Buffer.from(await cleanVideoData.arrayBuffer()))

        // 2. Tải audio từ Supabase về RAM
        const { data: audioData, error: err2 } = await supabase.storage
            .from('stream-files')
            .download(audio)
        if (err2 || !audioData) {
            console.error('❌ Không tải được audio:', err2)
            continue
        }
        fs.writeFileSync(tmpAudio, Buffer.from(await audioData.arrayBuffer()))

        // 3. Dùng FFmpeg để ghép video và audio → ra tmpOutput
        try {
            console.log('🔧 Ghép video + audio...')
            await execPromise(`ffmpeg -y -i ${tmpCleanVideo} -i ${tmpAudio} -c:v copy -c:a aac ${tmpOutput}`)
            console.log('✅ Ghép xong:', tmpOutput)
        } catch (err) {
            console.error('❌ Lỗi khi chạy FFmpeg merge:', err)
            continue
        }

        // 4. Upload file hoàn chỉnh lên Supabase
        try {
            const { error: uploadError } = await supabase.storage
                .from('stream-files')
                .upload(`outputs/${outputName}`, fs.createReadStream(tmpOutput), {
                    contentType: 'video/mp4',
                    duplex: 'half',
                })

            if (uploadError) {
                console.error('❌ Lỗi upload lên Supabase:', uploadError)
                continue
            }

            console.log('📤 Upload lên Supabase thành công:', `outputs/${outputName}`)
        } catch (err) {
            console.error('❌ Lỗi khi upload merged video:', err)
            continue
        }

        // 5. Gọi job cleanup-worker.ts để dọn dẹp file gốc
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/trigger-cleanup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cleanVideo, audio }),
            })

            if (!res.ok) {
                const text = await res.text()
                console.warn('⚠️ Trigger cleanup thất bại:', text)
            } else {
                console.log('🧹 Đã gọi job cleanup-worker.ts')
            }
        } catch (err) {
            console.warn('⚠️ Không gọi được API cleanup:', err)
        }
    }
}

runMergeWorker().catch((err) => console.error('❌ Worker crash:', err))
