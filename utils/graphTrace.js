import { OUTPUT_COLUMNS, toCsv } from './prepareCsv'
import { INTERNAL_DOMAINS, resolvePerson } from './roster'
import { localFields, localMidnightMs } from './timezone'

/**
 * Microsoft Graph message trace ingestion.
 *
 * Replaces the manual "export from the admin centre, drop the CSV in" loop.
 * Microsoft retired the Reporting Web Service message trace endpoints on
 * 6 April 2026; the Graph API below is the supported successor.
 *
 * The output is byte-compatible with what utils/prepareCsv.js produces from a
 * hand-uploaded export, so nothing downstream — parsing, dedup, the recipient
 * index, the analytics — needs to know where a file came from. Graph-synced and
 * hand-uploaded files can be selected together and dedup correctly against each
 * other, because both key on the internet message id.
 *
 * Two limits shape everything here:
 *
 *  - Trace data only goes back 90 days. Graph cannot backfill the historical
 *    exports already in blob storage; those stay as the archive.
 *  - A single query may not span more than 10 days, so any wider range is
 *    walked in chunks.
 *
 * Docs: https://learn.microsoft.com/en-us/exchange/monitoring/trace-an-email-message/graph-api-message-trace
 */

const GRAPH_BASE = 'https://graph.microsoft.com/beta/admin/exchange/tracing/messageTraces'
const DAY = 86400000

export const MAX_LOOKBACK_DAYS = 90
export const MAX_WINDOW_DAYS = 10
export const PAGE_SIZE = 5000

// Graph allows 100 requests per tenant per rolling 5 minutes, shared between
// the trace and trace-detail endpoints. Staying well under it leaves headroom
// for a manual "Sync now" landing on top of the nightly cron.
const REQUEST_BUDGET = 80

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export function graphConfig(env = process.env) {
  const tenantId = env.GRAPH_TENANT_ID || env.AZURE_AD_TENANT_ID
  const clientId = env.GRAPH_CLIENT_ID
  const clientSecret = env.GRAPH_CLIENT_SECRET
  const missing = []
  if (!tenantId) missing.push('GRAPH_TENANT_ID')
  if (!clientId) missing.push('GRAPH_CLIENT_ID')
  if (!clientSecret) missing.push('GRAPH_CLIENT_SECRET')
  return { tenantId, clientId, clientSecret, missing }
}

/**
 * App-only access token via the client credentials flow. There is no signed-in
 * user on a cron run, and message trace is tenant-wide data, so this
 * deliberately does not reuse the NextAuth delegated token.
 */
export async function getGraphToken(config) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      `Graph token request failed (${response.status}): ${
        payload.error_description || payload.error || response.statusText
      }`
    )
  }
  if (!payload.access_token) throw new Error('Graph token response contained no access_token')
  return payload.access_token
}

/* ------------------------------------------------------------------ *
 * Fetching
 * ------------------------------------------------------------------ */

function isoAt(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Split a range into windows Graph will accept. Ranges are half-open going in
 * and the filter is inclusive on both ends, so each window's end is pulled back
 * a second — any straggler that still lands twice collapses in grouping anyway.
 */
export function splitWindows(fromMs, toMs, windowDays = MAX_WINDOW_DAYS) {
  const windows = []
  const span = windowDays * DAY
  for (let start = fromMs; start < toMs; start += span) {
    windows.push({ start, end: Math.min(start + span, toMs) })
  }
  return windows
}

async function graphGet(url, token, state) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (state.requests >= REQUEST_BUDGET) {
      throw new Error(
        `Graph request budget of ${REQUEST_BUDGET} exhausted. Narrow the sync range and try again.`
      )
    }
    state.requests += 1

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (response.status === 429 || response.status === 503) {
      // Graph tells us how long to wait; default to a short pause when it does not.
      const retryAfter = Number(response.headers.get('retry-after')) || 10
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 30) * 1000))
      continue
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Graph request failed (${response.status}): ${text.slice(0, 400)}`)
    }

    return response.json()
  }
  throw new Error('Graph request throttled repeatedly; giving up for this run.')
}

/**
 * Every message trace row in [fromMs, toMs). One row per message *per
 * recipient*, which is exactly the shape groupTraces expects.
 */
export async function fetchMessageTraces({ token, fromMs, toMs, onProgress }) {
  const state = { requests: 0 }
  const traces = []

  for (const window of splitWindows(fromMs, toMs)) {
    const filter =
      `receivedDateTime ge ${isoAt(window.start)} and ` +
      `receivedDateTime le ${isoAt(window.end - 1000)}`
    let url = `${GRAPH_BASE}?$filter=${encodeURIComponent(filter)}&$top=${PAGE_SIZE}`

    while (url) {
      const payload = await graphGet(url, token, state)
      const batch = payload.value || []
      traces.push(...batch)
      // Follow the whole nextLink verbatim — it carries an opaque $skiptoken
      // that must not be rebuilt by hand.
      url = payload['@odata.nextLink'] || null
      if (onProgress) onProgress({ traces: traces.length, requests: state.requests })
    }
  }

  return { traces, requests: state.requests }
}

/* ------------------------------------------------------------------ *
 * Mapping to the condensed CSV shape
 * ------------------------------------------------------------------ */

const internal = new Set(INTERNAL_DOMAINS.map((domain) => domain.toLowerCase()))

function isInternal(address) {
  const at = String(address || '').lastIndexOf('@')
  return at !== -1 && internal.has(String(address).slice(at + 1).trim().toLowerCase())
}

/**
 * Collapse trace rows to one row per email, unioning recipients.
 *
 * Mirrors condenseTrace() in utils/prepareCsv.js: same key (message id first,
 * then the trace id), same earliest-timestamp rule, same output columns. Graph
 * does not return a directionality field, so it is derived from the sender
 * domain using the same vocabulary the Exchange export uses.
 */
export function groupTraces(traces) {
  const messages = new Map()

  for (const trace of traces || []) {
    const messageId = trace.messageId || ''
    const traceId = trace.id || ''
    const key = messageId ? `msg_${messageId}` : traceId ? `net_${traceId}` : null
    if (!key) continue

    let entry = messages.get(key)
    if (!entry) {
      entry = {
        timestamp: '',
        messageId,
        traceId,
        sender: '',
        subject: '',
        recipients: new Set(),
        events: 0,
      }
      messages.set(key, entry)
    }

    const timestamp = trace.receivedDateTime ? isoAt(Date.parse(trace.receivedDateTime)) : ''
    if (timestamp && (!entry.timestamp || timestamp < entry.timestamp)) entry.timestamp = timestamp
    if (!entry.sender && trace.senderAddress) entry.sender = trace.senderAddress
    if (!entry.subject && trace.subject) entry.subject = trace.subject
    if (!entry.traceId && traceId) entry.traceId = traceId
    if (trace.recipientAddress) entry.recipients.add(String(trace.recipientAddress).toLowerCase())
    entry.events += 1
  }

  return Array.from(messages.values()).map((entry) => [
    entry.timestamp,
    entry.messageId,
    entry.traceId,
    entry.sender,
    Array.from(entry.recipients).sort().join(';'),
    entry.subject,
    isInternal(entry.sender) ? 'Originating' : 'Incoming',
    entry.events,
  ])
}

/**
 * Drop emails that no roster person is party to.
 *
 * Unlike the hand-made exports, a tenant-wide pull picks up everything —
 * including mail that only ever touches a shared role mailbox like trading@ or
 * info@. utils/roster.js already excludes those from the analytics, so keeping
 * them only makes the files bigger and every page load slower.
 *
 * A message is kept when the sender or *any* recipient resolves to a person, so
 * mail addressed to both a role mailbox and a person survives intact.
 */
export function keepRosterRelevant(rows) {
  return rows.filter((row) => {
    if (resolvePerson(row[3])) return true
    return String(row[4] || '')
      .split(';')
      .some((address) => address && resolvePerson(address))
  })
}

/**
 * Bucket grouped rows by the Santos calendar month they belong to, so each
 * month lands in its own blob and the file drawer keeps working the way it
 * does today. Keyed "YYYY-MM".
 */
export function bucketByMonth(rows) {
  const buckets = new Map()
  for (const row of rows) {
    const ms = Date.parse(row[0])
    if (!Number.isFinite(ms)) continue
    const { year, month } = localFields(ms)
    const key = `${year}-${String(month + 1).padStart(2, '0')}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = []
      buckets.set(key, bucket)
    }
    bucket.push(row)
  }

  for (const bucket of buckets.values()) bucket.sort((a, b) => (a[0] < b[0] ? -1 : 1))
  return buckets
}

export function rowsToCsv(rows) {
  return toCsv(OUTPUT_COLUMNS, rows)
}

export function monthKeyOf(ms) {
  const { year, month } = localFields(ms)
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ *
 * Sync range
 * ------------------------------------------------------------------ */

/**
 * The range a sync run should pull.
 *
 * Default is the current month to date, widened to include the previous month
 * for the first few days after a rollover so mail near the boundary still
 * lands. `days` overrides that for backfills.
 *
 * The start is then snapped back to its month boundary, because these blobs are
 * written whole: fetching from mid-month would produce a file that looks
 * complete but silently begins on the 13th. Snapping can reach past what Graph
 * retains, so the 90-day floor is applied last and `clampedByRetention` records
 * that it bit — the caller uses that to avoid overwriting a complete month file
 * with a truncated one.
 */
export function resolveSyncRange(nowMs, days = 0) {
  const floor = nowMs - MAX_LOOKBACK_DAYS * DAY
  const { year, month, day } = localFields(nowMs)

  let from
  if (days) from = nowMs - days * DAY
  else if (day <= 3) from = localMidnightMs(year, month - 1, 1)
  else from = localMidnightMs(year, month, 1)

  const start = localFields(from)
  const snapped = localMidnightMs(start.year, start.month, 1)
  const clamped = Math.max(snapped, floor)

  return { from: clamped, to: nowMs, clampedByRetention: clamped > snapped }
}
