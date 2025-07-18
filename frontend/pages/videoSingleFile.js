"use strict";
'use client';
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
exports.default = VideoSingleFile;
const react_1 = require("react");
function VideoSingleFile() {
    const [file, setFile] = (0, react_1.useState)(null);
    const [isUploading, setIsUploading] = (0, react_1.useState)(false);
    const [room, setRoom] = (0, react_1.useState)('');
    const [fileKey, setFileKey] = (0, react_1.useState)('');
    const [status, setStatus] = (0, react_1.useState)('');
    const handleFileChange = (e) => {
        var _a;
        if ((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0]) {
            setFile(e.target.files[0]);
        }
    };
    const handleUpload = () => __awaiter(this, void 0, void 0, function* () {
        if (!file)
            return;
        setIsUploading(true);
        setStatus('STEP 1: Upload video lên R2...');
        const formData = new FormData();
        formData.append('file', file);
        // ✅ Sửa tại đây: không gắn sẵn /upload
        const ingressUrl = process.env.NEXT_PUBLIC_INGRESS_WORKER_URL || 'https://onlook-ingress-url-from-env';
        try {
            const res = yield fetch(`${ingressUrl}/upload`, {
                method: 'POST',
                body: formData,
            });
            const text = yield res.text();
            let data = {};
            try {
                data = JSON.parse(text);
            }
            catch (e) {
                console.error('❌ Không thể parse JSON:', text);
                setStatus('❌ Upload thất bại (response không hợp lệ)');
                return;
            }
            if (res.ok) {
                setRoom(data.roomName);
                setFileKey(data.fileKey);
                setStatus(`🚀 Đã tạo room: ${data.roomName}, file: ${data.fileKey}`);
            }
            else {
                setStatus(`❌ Upload thất bại: ${data.error || 'Không rõ nguyên nhân'}`);
            }
        }
        catch (err) {
            console.error('❌ Lỗi khi upload:', err);
            setStatus('❌ Lỗi khi upload video');
        }
        finally {
            setIsUploading(false);
        }
    });
    const handleStop = () => __awaiter(this, void 0, void 0, function* () {
        if (!room || !fileKey) {
            setStatus('❌ Thiếu room hoặc file để dừng');
            return;
        }
        setStatus('🛑 Đang dừng livestream...');
        const deleteUrl = process.env.NEXT_PUBLIC_DELETE_WORKER_URL || 'https://onlook-delete-url-from-env';
        try {
            const res = yield fetch(`${deleteUrl}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName: room, fileKey }),
            });
            const text = yield res.text();
            let data = {};
            try {
                data = JSON.parse(text);
            }
            catch (e) {
                console.error('❌ Không thể parse JSON khi dừng:', text);
                setStatus('❌ Lỗi khi dừng: Phản hồi không hợp lệ');
                return;
            }
            if (res.ok) {
                setStatus('✅ Đã dừng livestream và xoá file thành công');
                setRoom('');
                setFileKey('');
                setFile(null);
            }
            else {
                setStatus(`❌ Lỗi khi dừng: ${data.error || 'Không rõ nguyên nhân'}`);
            }
        }
        catch (err) {
            console.error('❌ Lỗi khi gọi delete worker:', err);
            setStatus('❌ Lỗi khi gọi worker delete');
        }
    });
    return (<div style={{ padding: 20 }}>
            <h2>🎬 Upload Video Livestream (Phương thức 4)</h2>
            <input type="file" accept="video/mp4" onChange={handleFileChange}/>
            <button onClick={handleUpload} disabled={isUploading || !file}>
                {isUploading ? 'Uploading...' : 'Tải lên & Tạo Livestream'}
            </button>

            {room && fileKey && (<button onClick={handleStop} style={{ marginLeft: 10 }} disabled={isUploading}>
                    🛑 Dừng Livestream & Xoá file
                </button>)}

            <div style={{ marginTop: 20 }}>
                <p><strong>Trạng thái:</strong> {status}</p>
            </div>
        </div>);
}
