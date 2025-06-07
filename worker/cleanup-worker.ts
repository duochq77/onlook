import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function cleanupFiles() {
    console.log('🧹 Cleanup Worker đang chạy...');

    const rawJob = await redis.lpop('ffmpeg-jobs:cleanup');
    if (!rawJob) {
        console.log('⏹ Không có file cần xóa. Kết thúc worker.');
        return;
    }

    const job = JSON.parse(rawJob as string);

    console.log('📦 Nhận job CLEANUP:', job);

    const tmpFiles = [
        path.join('/tmp', 'input.mp4'),
        path.join('/tmp', 'clean-video.mp4'),
        path.join('/tmp', 'merged-video.mp4'),
    ];

    for (const file of tmpFiles) {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`✅ Đã xóa: ${file}`);
            }
        } catch (err) {
            console.error(`❌ Lỗi xóa file: ${file}`, err);
        }
    }

    const { error } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .remove([`outputs/${job.outputName}`]);

    if (error) {
        console.error('❌ Lỗi xóa file trên Supabase:', error);
        return;
    }

    console.log('✅ Đã xóa video hoàn chỉnh trên Supabase.');
}

cleanupFiles().catch(console.error);
