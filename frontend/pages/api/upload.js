"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handler;
const formidable_1 = require("formidable");
const fs_1 = require("fs");
const client_s3_1 = require("@aws-sdk/client-s3");
exports.config = {
    api: {
        bodyParser: false,
    },
};
// Cấu hình Cloudflare R2
const R2 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
function handler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const form = new formidable_1.IncomingForm({ uploadDir: '/tmp', keepExtensions: true });
        form.parse(req, (err, fields, files) => __awaiter(this, void 0, void 0, function* () {
            if (err || !files.file) {
                return res.status(500).json({ error: 'Lỗi khi xử lý upload' });
            }
            // Xử lý file đầu vào từ Formidable
            const file = Array.isArray(files.file) ? files.file[0] : files.file;
            const filePath = file.filepath;
            const originalName = file.originalFilename || 'upload.mp4';
            const key = `${Date.now()}-${originalName}`;
            const uploadCommand = new client_s3_1.PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: (0, fs_1.createReadStream)(filePath),
                ContentType: 'video/mp4',
            });
            try {
                yield R2.send(uploadCommand);
                res.status(200).json({
                    message: '✅ Upload thành công',
                    key,
                });
            }
            catch (e) {
                res.status(500).json({ error: '❌ Upload thất bại', detail: String(e) });
            }
        }));
    });
}
