import { useState } from 'react';

export default function VideoSingleFile() {
    const [isUploading, setIsUploading] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                setIsLive(true);
                console.log('Video uploaded and livestream started.');
            } else {
                console.error('Upload failed');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleStop = async () => {
        const res = await fetch('/api/stop', { method: 'POST' });
        if (res.ok) {
            setIsLive(false);
            console.log('Livestream stopped and video deleted.');
        } else {
            console.error('Failed to stop livestream.');
        }
    };

    return (
        <div>
            {!isLive ? (
                <>
                    <input type="file" onChange={handleFileChange} />
                    <button onClick={handleUpload} disabled={isUploading}>
                        {isUploading ? 'Uploading...' : 'Upload Video'}
                    </button>
                </>
            ) : (
                <button onClick={handleStop}>Stop Livestream</button>
            )}
        </div>
    );
}
