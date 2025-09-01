import { filterDataByUser, canAccessAllData } from './permissions'

/**
 * Generate a unique identifier for an email record to detect duplicates
 * Uses a combination of fields that should be unique for each email
 */
export function generateEmailUniqueId(row) {
  // Get timestamp - handle both field names
  const timestamp = row['date_time_utc'] || row['origin_timestamp_utc'] || ''
  const messageId = row['message_id'] || ''
  const networkMessageId = row['network_message_id'] || ''
  const sender = row['sender_address'] || ''
  const subject = (row['message_subject'] || '').trim()
  
  // Primary method: Use message_id if available (most reliable)
  if (messageId) {
    return `msg_${messageId}`
  }
  
  // Secondary method: Use network_message_id if available
  if (networkMessageId) {
    return `net_${networkMessageId}`
  }
  
  // Fallback method: Create composite key from timestamp + sender + subject hash
  if (timestamp && sender) {
    // Create a simple hash of the subject to handle long subjects
    let subjectHash = 0
    for (let i = 0; i < subject.length; i++) {
      const char = subject.charCodeAt(i)
      subjectHash = ((subjectHash << 5) - subjectHash) + char
      subjectHash = subjectHash & subjectHash // Convert to 32-bit integer
    }
    
    return `composite_${timestamp}_${sender}_${subjectHash}`
  }
  
  // Last resort: Use all available fields
  return `fallback_${timestamp}_${sender}_${subject.substring(0, 50)}_${messageId}_${networkMessageId}`
}

/**
 * Remove duplicate emails from a combined dataset
 * Returns deduplicated data with statistics
 */
export function deduplicateEmails(rows, debugMode = false) {
  if (!rows || rows.length === 0) {
    return { 
      deduplicatedRows: [], 
      duplicatesRemoved: 0, 
      uniqueEmails: 0,
      duplicateDetails: []
    }
  }
  
  const seenEmails = new Map() // uniqueId -> first occurrence
  const deduplicatedRows = []
  const duplicateDetails = []
  let duplicatesRemoved = 0
  
  rows.forEach((row, index) => {
    const uniqueId = generateEmailUniqueId(row)
    
    if (seenEmails.has(uniqueId)) {
      // This is a duplicate
      duplicatesRemoved++
      const firstOccurrence = seenEmails.get(uniqueId)
      
      if (debugMode) {
        duplicateDetails.push({
          uniqueId,
          firstFile: firstOccurrence._source_file,
          duplicateFile: row._source_file,
          timestamp: row['date_time_utc'] || row['origin_timestamp_utc'],
          sender: row['sender_address'],
          subject: (row['message_subject'] || '').substring(0, 100)
        })
      }
    } else {
      // This is unique, keep it
      seenEmails.set(uniqueId, row)
      deduplicatedRows.push(row)
    }
  })
  
  if (debugMode && duplicatesRemoved > 0) {
    console.log(`Email Deduplication Results:`)
    console.log(`- Total emails processed: ${rows.length}`)
    console.log(`- Unique emails kept: ${deduplicatedRows.length}`)
    console.log(`- Duplicates removed: ${duplicatesRemoved}`)
    
    // Show sample duplicate details (max 5)
    const sampleDuplicates = duplicateDetails.slice(0, 5)
    if (sampleDuplicates.length > 0) {
      console.log(`\nSample duplicates removed:`)
      sampleDuplicates.forEach((dup, i) => {
        console.log(`${i + 1}. ${dup.sender} -> "${dup.subject}" (${dup.firstFile} vs ${dup.duplicateFile})`)
      })
      if (duplicateDetails.length > 5) {
        console.log(`... and ${duplicateDetails.length - 5} more duplicates`)
      }
    }
  }
  
  return {
    deduplicatedRows,
    duplicatesRemoved,
    uniqueEmails: deduplicatedRows.length,
    duplicateDetails
  }
}

// Parse CSV text and return structured data with user filtering
export function parseCsv(csvText, fileName = 'unknown', session = null) {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length === 0) return null

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

  // Validate this is an email tracking CSV
  const requiredEmailHeaders = ['date_time_utc', 'sender_address']
  const hasEmailHeaders = requiredEmailHeaders.some(header =>
    headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
  )

  if (!hasEmailHeaders) {
    console.warn('Skipping non-email CSV file:', fileName, 'Headers:', headers)
    return null
  }

  const rows = lines.slice(1).map(line => {
    const values = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/"/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim().replace(/"/g, ''))

    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    row._source_file = fileName
    return row
  })

  const filteredRows = filterDataByUser(rows, session)

  return {
    headers,
    rows: filteredRows,
    allRows: rows,
    isFiltered: !canAccessAllData(session),
    userRole: session?.user?.role || 'user',
    sourceFile: fileName
  }
}

// Merge multiple parsed CSV datasets into one with deduplication
export function mergeCsvData(parsedDataArray) {
  if (parsedDataArray.length === 0) return null
  if (parsedDataArray.length === 1) return parsedDataArray[0]

  const allHeaders = new Set()
  parsedDataArray.forEach(data => {
    data.headers.forEach(header => allHeaders.add(header))
  })
  const mergedHeaders = Array.from(allHeaders)

  const allRows = []
  const allUnfilteredRows = []
  parsedDataArray.forEach(data => {
    allRows.push(...data.rows)
    allUnfilteredRows.push(...data.allRows)
  })

  // Apply deduplication to both filtered and unfiltered data
  const enableDebugMode = process.env.NODE_ENV === 'development' // Enable detailed logging for debugging in development
  
  console.log(`\n🔍 Starting email deduplication across ${parsedDataArray.length} CSV files...`)
  
  // Deduplicate filtered rows (user-visible data)
  const filteredDeduplicationResult = deduplicateEmails(allRows, enableDebugMode)
  
  // Deduplicate unfiltered rows (admin-visible data) 
  console.log(`\n🔍 Deduplicating unfiltered data (admin view)...`)
  const unfilteredDeduplicationResult = deduplicateEmails(allUnfilteredRows, enableDebugMode)

  return {
    headers: mergedHeaders,
    rows: filteredDeduplicationResult.deduplicatedRows,
    allRows: unfilteredDeduplicationResult.deduplicatedRows,
    isFiltered: parsedDataArray[0].isFiltered,
    userRole: parsedDataArray[0].userRole,
    fileCount: parsedDataArray.length,
    totalRecords: filteredDeduplicationResult.uniqueEmails,
    // Add deduplication statistics
    deduplicationStats: {
      filtered: {
        originalCount: allRows.length,
        uniqueCount: filteredDeduplicationResult.uniqueEmails,
        duplicatesRemoved: filteredDeduplicationResult.duplicatesRemoved
      },
      unfiltered: {
        originalCount: allUnfilteredRows.length,
        uniqueCount: unfilteredDeduplicationResult.uniqueEmails,
        duplicatesRemoved: unfilteredDeduplicationResult.duplicatesRemoved
      }
    }
  }
}

