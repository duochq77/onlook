import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { videoPath, audioPath, outputName } = req.body as {
        videoPath: string
        audioPath: string
        outputName: string
    }

    if (!videoPath || !audioPath || !outputName) {
        return res.status(400).json({ error: 'Missing parameters' })
    }

    const ffmpegPath = 'ffmpeg' // ffmpeg phải được cài đặt trên server
    const outputPath = path.join('/tmp', outputName)
    const command = `${ffmpegPath} -i ${videoPath} -i ${audioPath} -c:v copy -c:a aac -shortest ${outputPath}`

    exec(command, async (error) => {
        if (error) {
            return res.status(500).json({ error: 'FFmpeg processing failed', details: error.message })
        }

        const fileBuffer = fs.readFileSync(outputPath)
        const { data, error: uploadError } = await supabase.storage.from('uploads').upload(`processed/${outputName}`, fileBuffer, {
            contentType: 'video/mp4',
            upsert: true,
        })

        if (uploadError) {
            return res.status(500).json({ error: 'Upload failed', details: uploadError.message })
        }

        fs.unlinkSync(outputPath)

        return res.status(200).json({ message: 'Processing complete', path: data.path })
    })
}
