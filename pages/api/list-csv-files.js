import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"
import { list } from '@vercel/blob';

// Helper function to parse CSV and extract date range from blob URL
const extractDateRangeFromCSV = async (blobUrl) => {
  try {
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error('Failed to fetch blob content');
    
    const csvContent = await response.text();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return null;
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const timestampIndex = headers.findIndex(header => 
      header.toLowerCase().includes('timestamp') || 
      header.toLowerCase().includes('date') ||
      header.toLowerCase().includes('time') ||
      header.toLowerCase() === 'date_time_utc'
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
    console.error('CSV analysis error:', error);
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
    // List all blobs in the 'mails/' folder
    const { blobs } = await list({
      prefix: 'mails/',
      limit: 1000, // Adjust limit as needed
    });
    
    console.log('Blobs found:', blobs.length);

    // Filter CSV files and process them
    const csvBlobs = blobs.filter(blob => blob.pathname.endsWith('.csv'));
    console.log('CSV blobs found:', csvBlobs.length);

    // Process each CSV file to get analysis data
    const files = await Promise.all(
      csvBlobs.map(async (blob) => {
        try {
          // Extract filename from pathname (remove 'mails/' prefix)
          const filename = blob.pathname.replace('mails/', '');
          
          // Extract date range and record count from CSV (with error handling)
          let csvAnalysis = null;
          try {
            csvAnalysis = await extractDateRangeFromCSV(blob.url);
          } catch (csvError) {
            console.log('CSV analysis error for', filename, ':', csvError.message);
            csvAnalysis = { recordCount: 0, dateRange: null };
          }
          
          return {
            name: filename,
            size: blob.size,
            modified: blob.uploadedAt,
            url: blob.url, // Direct blob URL for downloads
            recordCount: csvAnalysis?.recordCount || 0,
            dateRange: csvAnalysis?.dateRange || null
          };
        } catch (fileError) {
          console.log('Blob processing error for', blob.pathname, ':', fileError.message);
          return null;
        }
      })
    );

    // Filter out null entries and sort by newest first
    const validFiles = files
      .filter(Boolean)
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    console.log('Final files array:', validFiles.length, 'files');
    res.status(200).json({ files: validFiles });
  } catch (error) {
    console.error('List CSV files error:', error);
    res.status(500).json({ error: 'Failed to list CSV files' });
  }
}