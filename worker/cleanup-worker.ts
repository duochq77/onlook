// worker/cleanup-worker.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    const videoFile = process.env.VIDEO_FILE
    const audioFile = process.env.AUDIO_FILE

    if (!videoFile || !audioFile) {
        console.error('❌ Thiếu VIDEO_FILE hoặc AUDIO_FILE trong ENV')
        process.exit(1)
    }

    console.log('🧹 Đang xoá các file gốc:', videoFile, audioFile)

    const { error } = await supabase.storage.from('stream-files').remove([
        `input-videos/${videoFile}`,
        `input-audios/${audioFile}`
    ])

    if (error) {
        console.error('❌ Lỗi xoá file:', error.message)
        process.exit(1)
    }

    console.log('✅ Đã xoá xong các file gốc thành công')
}

run().catch((err) => {
    console.error('❌ Lỗi cleanup:', err)
    process.exit(1)
})
