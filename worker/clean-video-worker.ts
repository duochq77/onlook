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

    try {
        // 🔥 Kiểm tra kết nối Redis trước khi lấy job
        const testKey = 'redis-test';
        await redis.set(testKey, 'connected');
        const redisStatus = await redis.get(testKey);
        console.log('🛠️ Kiểm tra kết nối Redis:', redisStatus);

        const rawJob = await redis.lpop('ffmpeg-jobs:clean');
        if (!rawJob) {
            console.log('⏹ Không có job nào trong hàng đợi. Kết thúc worker.');
            return;
        }

        const job = JSON.parse(rawJob as string);
        console.log('📦 Nhận job CLEAN:', job);

        const tmpInputPath = path.join('/tmp', 'input.mp4');
        const tmpOutputPath = path.join('/tmp', 'clean-video.mp4');

        // 🛠️ Tải video từ Supabase
        console.log('📥 Đang tải video từ Supabase:', job.inputVideo);
        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .download(job.inputVideo);

        if (error || !data) {
            console.error('❌ Lỗi tải video từ Supabase:', error);
            return;
        }

        fs.writeFileSync(tmpInputPath, Buffer.from(await data.arrayBuffer()));

        // ⚙️ Chạy FFmpeg để làm sạch video
        const ffmpegCmd = `ffmpeg -y -i ${tmpInputPath} -an -c:v copy ${tmpOutputPath}`;
        console.log('🎬 Chạy FFmpeg:', ffmpegCmd);

        try {
            await execPromise(ffmpegCmd);
            console.log('✅ Đã tạo video sạch:', tmpOutputPath);
        } catch (err) {
            console.error('💥 FFmpeg lỗi:', err);
            return;
        }

        // 📤 Upload lại lên Supabase
        console.log('🚀 Đang upload video sạch lên Supabase...');
        const { error: uploadError } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .upload(`outputs/${job.outputName}`, fs.readFileSync(tmpOutputPath), { upsert: true });

        if (uploadError) {
            console.error('❌ Lỗi upload video sạch lên Supabase:', uploadError);
            return;
        }

        console.log('✅ Worker đã hoàn thành job:', job.outputName);
    } catch (err) {
        console.error('💥 Worker lỗi:', err);
    }
}

runWorker().catch(console.error);
