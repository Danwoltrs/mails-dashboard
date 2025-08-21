import fs from 'fs';
import path from 'path';
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"

// Helper function to parse CSV and extract date range
const extractDateRangeFromCSV = (filePath) => {
  try {
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return null;
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const timestampIndex = headers.findIndex(header => 
      header.toLowerCase().includes('timestamp') || 
      header.toLowerCase().includes('date') ||
      header.toLowerCase().includes('time')
    );
    
    if (timestampIndex === -1) return null;
    
    const dates = [];
    let recordCount = 0;
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/"/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/"/g, ''));
      
      const timestamp = values[timestampIndex];
      if (timestamp && timestamp.trim()) {
        try {
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            dates.push(date);
          }
        } catch (e) {
          // Invalid timestamp, skip
        }
      }
      recordCount++;
    }
    
    if (dates.length === 0) return { recordCount, dateRange: null };
    
    dates.sort((a, b) => a - b);
    return {
      recordCount,
      dateRange: {
        earliest: dates[0],
        latest: dates[dates.length - 1]
      }
    };
  } catch (error) {
    return null;
  }
};

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
        
        // Extract date range and record count from CSV
        const csvAnalysis = extractDateRangeFromCSV(filePath);
        
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: `/mails/${file}`,
          recordCount: csvAnalysis?.recordCount || 0,
          dateRange: csvAnalysis?.dateRange || null
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Sort by newest first

    res.status(200).json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list CSV files' });
  }
}