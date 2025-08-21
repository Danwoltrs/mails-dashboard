import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"
import { del, list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
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
    // Find the blob by filename to get its URL
    const { blobs } = await list({
      prefix: 'mails/',
      limit: 1000,
    });
    
    const blob = blobs.find(b => b.pathname === `mails/${filename}`);
    
    if (!blob) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete the blob
    await del(blob.url);
    
    res.status(200).json({ 
      success: true, 
      message: `File ${filename} deleted successfully` 
    });
  } catch (error) {
    console.error('Delete CSV error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}