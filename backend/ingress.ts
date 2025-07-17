import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default function handler(req, res) {
    const form = new IncomingForm();
    form.uploadDir = './public/uploads';
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
        if (err) {
            res.status(500).json({ error: 'Something went wrong during file upload.' });
            return;
        }

        const oldPath = files.file[0].filepath;
        const newPath = path.join(form.uploadDir, files.file[0].originalFilename);
        fs.renameSync(oldPath, newPath);

        res.status(200).json({ filePath: newPath });
    });
}
