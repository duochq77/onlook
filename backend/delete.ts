import express from 'express'
import dotenv from 'dotenv'
import { deleteFromR2 } from './utils/r2'
import { stopRoom } from './utils/livekit'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.json())

// Endpoint kiểm tra trạng thái service
app.get('/', (_, res) => {
    res.send('✅ Delete worker is running')
})

// Endpoint nhận yêu cầu xoá video và dừng phòng
app.post('/', async (req, res) => {
    const { room, key } = req.body

    if (!room || !key) {
        return res.status(400).json({ error: 'Thiếu ROOM hoặc FILE_KEY' })
    }

    try {
        console.log(`🛑 Dừng phòng LiveKit: ${room}`)
        await stopRoom(room)

        console.log(`🧹 Xóa file từ R2: ${key}`)
        await deleteFromR2(key)

        res.status(200).json({ message: '✅ Đã xoá video và dừng livestream' })
    } catch (err) {
        console.error('❌ Lỗi xử lý:', err)
        res.status(500).json({ error: 'Xoá thất bại', detail: String(err) })
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Delete worker listening on port ${PORT}`)
})
