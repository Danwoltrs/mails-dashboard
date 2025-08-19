import formidable from 'formidable';
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Ensure upload directory exists
    const uploadDir = './public/mails';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      filename: (name, ext, part) => {
        // Keep original filename but ensure it's unique
        const timestamp = Date.now();
        const originalName = part.originalFilename || 'upload';
        const nameWithoutExt = path.parse(originalName).name;
        return `${nameWithoutExt}_${timestamp}.csv`;
      },
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Form parsing error:', err);
        return res.status(500).json({ error: 'Failed to parse form data' });
      }

      const file = files.csvFile;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file type
      if (!file.originalFilename?.endsWith('.csv')) {
        // Remove uploaded file if it's not CSV
        if (fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
        return res.status(400).json({ error: 'Only CSV files are allowed' });
      }

      res.status(200).json({ 
        success: true, 
        filename: path.basename(file.filepath),
        message: 'File uploaded successfully' 
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}