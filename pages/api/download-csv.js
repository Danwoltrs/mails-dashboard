import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { filename } = req.query;
  
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  try {
    // Find the blob by filename
    const { blobs } = await list({
      prefix: 'mails/',
      limit: 1000,
    });
    
    const blob = blobs.find(b => b.pathname === `mails/${filename}`);
    
    if (!blob) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Fetch the file content
    const response = await fetch(blob.url);
    if (!response.ok) {
      throw new Error('Failed to fetch file content');
    }
    
    const content = await response.text();
    
    // Set appropriate headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));
    
    res.status(200).send(content);
  } catch (error) {
    console.error('Download CSV error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
}