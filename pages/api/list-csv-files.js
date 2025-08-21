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
    
    console.log('Checking directory:', mailsDir);
    console.log('Directory exists:', fs.existsSync(mailsDir));
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(mailsDir)) {
      console.log('Creating directory:', mailsDir);
      fs.mkdirSync(mailsDir, { recursive: true });
      return res.status(200).json({ files: [] });
    }

    // Read all files in directory
    const allFiles = fs.readdirSync(mailsDir);
    console.log('All files in directory:', allFiles);
    
    // Filter CSV files
    const csvFiles = allFiles.filter(file => file.endsWith('.csv'));
    console.log('CSV files found:', csvFiles);

    // Read all CSV files from the directory
    const files = csvFiles.map(file => {
      try {
        const filePath = path.join(mailsDir, file);
        const stats = fs.statSync(filePath);
        
        // Extract date range and record count from CSV (with error handling)
        let csvAnalysis = null;
        try {
          csvAnalysis = extractDateRangeFromCSV(filePath);
        } catch (csvError) {
          console.log('CSV analysis error for', file, ':', csvError.message);
          csvAnalysis = { recordCount: 0, dateRange: null };
        }
        
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: `/mails/${file}`,
          recordCount: csvAnalysis?.recordCount || 0,
          dateRange: csvAnalysis?.dateRange || null
        };
      } catch (fileError) {
        console.log('File processing error for', file, ':', fileError.message);
        return null;
      }
    })
    .filter(Boolean) // Remove null entries
    .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Sort by newest first

    console.log('Final files array:', files.length, 'files');
    res.status(200).json({ files });
  } catch (error) {
    console.error('List CSV files error:', error);
    res.status(500).json({ error: 'Failed to list CSV files' });
  }
}