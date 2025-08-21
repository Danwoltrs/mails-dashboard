import formidable from 'formidable';
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"
import { put } from '@vercel/blob';
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

  // Debug environment variables
  console.log('Environment variables check:', {
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    availableEnvVars: Object.keys(process.env).filter(key => key.includes('BLOB'))
  });

  // Check if blob token is available
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not found in environment variables');
    return res.status(500).json({ 
      error: 'Blob storage not configured. Please set up BLOB_READ_WRITE_TOKEN environment variable.' 
    });
  }

  try {
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to parse form data' });
      }
      
      let file = files.csvFile;
      // Handle both single file and array of files
      if (Array.isArray(file)) {
        file = file[0];
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file type
      const originalFilename = file.originalFilename || file.name;
      
      if (!originalFilename?.endsWith('.csv')) {
        return res.status(400).json({ error: 'Only CSV files are allowed' });
      }

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const nameWithoutExt = path.parse(originalFilename).name;
        const uniqueFilename = `${nameWithoutExt}_${timestamp}.csv`;
        
        // Read file content
        const filepath = file.filepath || file.path;
        const fileBuffer = fs.readFileSync(filepath);
        
        // Upload to Vercel Blob Storage
        const blob = await put(`mails/${uniqueFilename}`, fileBuffer, {
          access: 'public',
          contentType: 'text/csv',
        });
        
        // Clean up temporary file
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }

        res.status(200).json({ 
          success: true, 
          filename: uniqueFilename,
          url: blob.url,
          message: 'File uploaded successfully' 
        });
      } catch (uploadError) {
        console.error('Blob upload error:', uploadError);
        res.status(500).json({ error: 'Failed to upload file to storage' });
      }
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}