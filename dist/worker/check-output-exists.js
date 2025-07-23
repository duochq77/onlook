"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const client_s3_1 = require("@aws-sdk/client-s3");
const BUCKET = process.env.NEXT_PUBLIC_R2_BUCKET;
const ENDPOINT = process.env.NEXT_PUBLIC_R2_ENDPOINT;
const ACCOUNT_ID = process.env.NEXT_PUBLIC_R2_ACCOUNT_ID;
const client = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { outputName } = req.query;
    if (!outputName || typeof outputName !== 'string') {
        return res.status(400).json({ error: 'Missing outputName' });
    }
    try {
        // Kiểm tra sự tồn tại của file
        const headCmd = new client_s3_1.HeadObjectCommand({
            Bucket: BUCKET,
            Key: outputName,
        });
        await client.send(headCmd);
        // Nếu tồn tại, trả về URL file để frontend hiển thị nút tải về
        const fileUrl = `${ENDPOINT}/${outputName}`;
        res.status(200).json({ exists: true, downloadUrl: fileUrl });
        // Tự động lên lịch xoá file sau 5 phút (300_000ms)
        setTimeout(async () => {
            try {
                const delCmd = new client_s3_1.DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: outputName,
                });
                await client.send(delCmd);
                console.log(`🗑️ File ${outputName} đã bị xoá sau 5 phút.`);
            }
            catch (err) {
                console.error(`❌ Xoá file thất bại: ${outputName}`, err);
            }
        }, 300000);
    }
    catch (err) {
        // Nếu không tìm thấy file
        if (err.$metadata?.httpStatusCode === 404) {
            return res.status(200).json({ exists: false });
        }
        console.error('❌ Lỗi check file:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
