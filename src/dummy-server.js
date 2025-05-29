// src/dummy-upload.ts
import http from 'http';
import '../worker/upload-video-worker'; // chạy upload worker
const port = process.env.PORT || 8080;
http.createServer((_, res) => {
    res.writeHead(200);
    res.end('✅ Upload video worker is running...');
}).listen(port, () => {
    console.log(`🌀 Dummy HTTP server is listening on port ${port}`);
});
