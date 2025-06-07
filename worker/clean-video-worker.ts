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
    console.log('🎬 CLEAN Video Worker đang chạy...');

    const rawJob = await redis.lpop('ffmpeg-jobs:clean');
    if (!rawJob) {
        console.log('⏹ Không có job nào trong hàng đợi. Kết thúc worker.');
        return;
    }

    const job = rawJob as { inputVideo: string; outputName: string };

    console.log('📦 Nhận job CLEAN:', job);

    const tmpInputPath = path.join('/tmp', 'input.mp4');
    const tmpOutputPath = path.join('/tmp', 'clean-video.mp4');

    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .download(job.inputVideo);

    if (error || !data) {
        console.error('❌ Lỗi tải video từ Supabase:', error);
        return;
    }

    fs.writeFileSync(tmpInputPath, Buffer.from(await data.arrayBuffer()));

    const ffmpegCmd = `ffmpeg -y -i ${tmpInputPath} -an -c:v copy ${tmpOutputPath}`;
    console.log('⚙️ Chạy FFmpeg:', ffmpegCmd);

    try {
        await execPromise(ffmpegCmd);
        console.log('✅ Đã tạo video sạch:', tmpOutputPath);
    } catch (err) {
        console.error('💥 FFmpeg lỗi:', err);
        return;
    }

    await fetch(process.env.SITE_URL + '/api/merge-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cleanVideo: tmpOutputPath,
            audio: job.inputVideo,
            outputName: job.outputName,
        }),
    });

    console.log('✅ Worker đã hoàn thành 1 job. Thoát.');
}

runWorker().catch(console.error);
