import { filterDataByUser, canAccessAllData } from './permissions'

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

// Merge multiple parsed CSV datasets into one
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

  return {
    headers: mergedHeaders,
    rows: allRows,
    allRows: allUnfilteredRows,
    isFiltered: parsedDataArray[0].isFiltered,
    userRole: parsedDataArray[0].userRole,
    fileCount: parsedDataArray.length,
    totalRecords: allRows.length
  }
}

