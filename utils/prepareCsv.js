import { generateEmailUniqueId } from './csv'

/**
 * Upload-time preparation for Exchange message trace exports.
 *
 * Raw detail exports are hostile to this app in three ways:
 *
 *  1. They are UTF-16LE, often with no BOM. Read as UTF-8 the headers come out
 *     as "\0d\0a\0t\0e..." and every column lookup misses, so the file parses
 *     to nothing at all.
 *  2. They are huge — 46 MB for three months — because 17 of the 27 columns are
 *     routing detail (custom_data and message_info alone are 12 MB) that
 *     nothing here reads.
 *  3. They carry one row per Exchange *event*, ~16 rows per email. That is what
 *     dedup exists to collapse, but it means the browser downloads and parses
 *     16× more data than there are emails.
 *
 * So the file is decoded, reduced to the columns the analytics reads, and
 * collapsed to one row per email — with recipients unioned across the event
 * rows, which is information the old load path threw away. 46 MB becomes
 * ~0.35 MB and every later page load is that much cheaper.
 *
 * Collapsing keys on message_id / network_message_id only. A row with neither
 * is passed through untouched so the existing composite dedup key still decides
 * its fate at merge time.
 */

export const OUTPUT_COLUMNS = [
  'date_time_utc',
  'message_id',
  'network_message_id',
  'sender_address',
  'recipient_address',
  'message_subject',
  'directionality',
  'event_rows',
]

const RECIPIENT_COLUMNS = ['recipient_address', 'recipient_status', 'related_recipient_address']

/* ---------------------------------------------------------------- *
 * Decoding
 * ---------------------------------------------------------------- */

export function detectEncoding(bytes) {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'

  // No BOM: Exchange still writes UTF-16LE. ASCII text in UTF-16LE puts a zero
  // byte in every odd position, which never happens in real UTF-8 CSV.
  const sample = Math.min(bytes.length, 512)
  let oddZeros = 0
  let evenZeros = 0
  for (let i = 0; i < sample; i += 2) {
    if (bytes[i] === 0) evenZeros += 1
    if (i + 1 < sample && bytes[i + 1] === 0) oddZeros += 1
  }
  const half = sample / 2
  if (oddZeros > half * 0.6) return 'utf-16le'
  if (evenZeros > half * 0.6) return 'utf-16be'
  return 'utf-8'
}

export function decodeCsvBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const encoding = detectEncoding(bytes)
  const text = new TextDecoder(encoding).decode(bytes)
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/* ---------------------------------------------------------------- *
 * Parsing and writing
 * ---------------------------------------------------------------- */

const COMMA = 44
const CR = 13
const LF = 10

/**
 * Full CSV parse: quoted fields, escaped quotes, embedded newlines, CRLF.
 * Index based rather than character-by-character so a 24M character export
 * stays quick.
 */
export function parseDelimited(text) {
  const rows = []
  let row = []
  let i = 0
  const length = text.length

  while (i < length) {
    let value

    if (text.charCodeAt(i) === 34) {
      i += 1
      let start = i
      let buffer = ''
      for (;;) {
        const quote = text.indexOf('"', i)
        if (quote === -1) {
          buffer += text.slice(start)
          i = length
          break
        }
        if (text.charCodeAt(quote + 1) === 34) {
          buffer += text.slice(start, quote + 1)
          i = quote + 2
          start = i
          continue
        }
        buffer += text.slice(start, quote)
        i = quote + 1
        break
      }
      value = buffer
    } else {
      let end = i
      while (end < length) {
        const code = text.charCodeAt(end)
        if (code === COMMA || code === LF || code === CR) break
        end += 1
      }
      value = text.slice(i, end)
      i = end
    }

    row.push(value)

    const code = text.charCodeAt(i)
    if (code === COMMA) {
      i += 1
      continue
    }
    if (code === CR) {
      i += 1
      if (text.charCodeAt(i) === LF) i += 1
    } else if (code === LF) {
      i += 1
    }
    rows.push(row)
    row = []
  }

  if (row.length) rows.push(row)
  return rows
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers, rows) {
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return lines.join('\n')
}

/* ---------------------------------------------------------------- *
 * Condensing
 * ---------------------------------------------------------------- */

function headerIndex(headers) {
  const index = {}
  headers.forEach((header, position) => {
    const key = header.trim().replace(/^﻿/, '').replace(/"/g, '').toLowerCase()
    if (key && index[key] === undefined) index[key] = position
  })
  return index
}

function recipientsOf(row, index) {
  const found = []
  for (const column of RECIPIENT_COLUMNS) {
    const position = index[column]
    if (position === undefined) continue
    const value = row[position]
    if (!value) continue
    for (const chunk of value.split(';')) {
      const address = (chunk.includes('##') ? chunk.slice(0, chunk.indexOf('##')) : chunk).trim()
      if (address) found.push(address)
    }
  }
  return found
}

/**
 * Collapse a decoded export to one row per email.
 *
 * Returns null when the text is not a message trace export, so the caller can
 * fall back to uploading it unchanged.
 */
export function condenseTrace(text) {
  const rows = parseDelimited(text)
  if (rows.length < 2) return null

  const headers = rows[0]
  const index = headerIndex(headers)
  const timestampColumn = index['date_time_utc'] ?? index['origin_timestamp_utc']
  if (timestampColumn === undefined || index['sender_address'] === undefined) return null

  const messages = new Map()
  const passthrough = []
  let rawRows = 0

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r]
    if (!row.length || !row.some((value) => value !== '')) continue
    rawRows += 1

    const at = (column) => {
      const position = index[column]
      return position === undefined ? '' : row[position] || ''
    }

    const timestamp = row[timestampColumn] || ''
    const messageId = at('message_id')
    const networkId = at('network_message_id')
    const key = messageId ? `msg_${messageId}` : networkId ? `net_${networkId}` : ''

    if (!key) {
      // No stable identifier: leave it alone and let dedup decide later.
      passthrough.push([
        timestamp,
        '',
        '',
        at('sender_address'),
        recipientsOf(row, index).join(';'),
        at('message_subject'),
        at('directionality'),
        1,
      ])
      continue
    }

    let entry = messages.get(key)
    if (!entry) {
      entry = {
        timestamp,
        messageId,
        networkId,
        sender: at('sender_address'),
        subject: at('message_subject'),
        directionality: at('directionality'),
        recipients: new Set(),
        events: 0,
      }
      messages.set(key, entry)
    }

    // Event rows for one email are seconds apart; the earliest is the moment it
    // was actually sent.
    if (timestamp && (!entry.timestamp || timestamp < entry.timestamp)) entry.timestamp = timestamp
    if (!entry.sender) entry.sender = at('sender_address')
    if (!entry.subject) entry.subject = at('message_subject')
    if (!entry.directionality) entry.directionality = at('directionality')
    if (!entry.networkId && networkId) entry.networkId = networkId
    entry.events += 1
    for (const address of recipientsOf(row, index)) entry.recipients.add(address.toLowerCase())
  }

  const out = []
  for (const entry of messages.values()) {
    out.push([
      entry.timestamp,
      entry.messageId,
      entry.networkId,
      entry.sender,
      Array.from(entry.recipients).sort().join(';'),
      entry.subject,
      entry.directionality,
      entry.events,
    ])
  }
  for (const row of passthrough) out.push(row)

  if (!out.length) return null

  return {
    csv: toCsv(OUTPUT_COLUMNS, out),
    stats: {
      rawRows,
      emails: out.length,
      collapsed: rawRows - out.length,
      passthrough: passthrough.length,
    },
  }
}

/**
 * Read a picked File, decode whatever encoding it is in, and condense it.
 * Falls back to a plain UTF-8 re-encode when the file is not a trace export.
 */
export async function prepareCsvFile(file) {
  const buffer = await file.arrayBuffer()
  const text = decodeCsvBuffer(buffer)
  const condensed = condenseTrace(text)

  if (!condensed) {
    return {
      blob: new Blob([text], { type: 'text/csv;charset=utf-8' }),
      stats: null,
      originalSize: file.size,
    }
  }

  return {
    blob: new Blob([condensed.csv], { type: 'text/csv;charset=utf-8' }),
    stats: condensed.stats,
    originalSize: file.size,
  }
}

// Kept for the dedup key check in tests: condensing must not change which
// emails the existing dedup considers identical.
export { generateEmailUniqueId }
