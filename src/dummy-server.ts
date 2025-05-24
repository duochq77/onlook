import http from 'http'
import '../worker/clean-video-worker.js' // chạy worker song song ✅

const port = process.env.PORT || 8080

http
    .createServer((_, res) => {
        res.writeHead(200)
        res.end('✅ Clean video worker is running')
    })
    .listen(port, () => {
        console.log(`🌀 Dummy HTTP server is listening on port ${port}`)
    })
