import fs from 'fs';
import path from 'path';
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const mailsDir = path.join(process.cwd(), 'public', 'mails');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(mailsDir)) {
      fs.mkdirSync(mailsDir, { recursive: true });
      return res.status(200).json({ files: [] });
    }

    // Read all CSV files from the directory
    const files = fs.readdirSync(mailsDir)
      .filter(file => file.endsWith('.csv'))
      .map(file => {
        const filePath = path.join(mailsDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: `/mails/${file}`
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Sort by newest first

    res.status(200).json({ files });
  } catch (error) {
    console.error('Error listing CSV files:', error);
    res.status(500).json({ error: 'Failed to list CSV files' });
  }
}