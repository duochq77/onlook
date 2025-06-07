import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function runWorker() {
    console.log('🎬 MERGE Video Worker đang chạy...');

    const rawJob = await redis.lpop('ffmpeg-jobs:merge');
    if (!rawJob) {
        console.log('⏹ Không có job nào trong hàng đợi. Kết thúc worker.');
        return;
    }

    const job = rawJob as { cleanVideo: string; audio: string; outputName: string };

    console.log('📦 Nhận job MERGE:', job);

    const tmpVideoPath = path.join('/tmp', 'clean-video.mp4');
    const tmpAudioPath = path.join('/tmp', 'audio.mp3');
    const tmpOutputPath = path.join('/tmp', 'merged-video.mp4');

    fs.copyFileSync(job.cleanVideo, tmpVideoPath);

    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .download(job.audio);

    if (error || !data) {
        console.error('❌ Lỗi tải audio từ Supabase:', error);
        return;
    }

    fs.writeFileSync(tmpAudioPath, Buffer.from(await data.arrayBuffer()));

    const ffmpegCmd = `ffmpeg -y -i ${tmpVideoPath} -i ${tmpAudioPath} -c:v copy -c:a aac ${tmpOutputPath}`;
    console.log('⚙️ Chạy FFmpeg:', ffmpegCmd);

    try {
        await execPromise(ffmpegCmd);
        console.log('✅ Đã ghép âm thanh vào video:', tmpOutputPath);
    } catch (err) {
        console.error('💥 FFmpeg lỗi:', err);
        return;
    }

    const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .upload(`outputs/${job.outputName}`, fs.readFileSync(tmpOutputPath), { upsert: true });

    if (uploadError) {
        console.error('❌ Lỗi upload video hoàn chỉnh lên Supabase:', uploadError);
        return;
    }

    console.log('🚀 Merge hoàn tất! Video đã được lưu vào Supabase.');
}

runWorker().catch(console.error);
