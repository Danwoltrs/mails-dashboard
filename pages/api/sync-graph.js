import { getServerSession } from 'next-auth/next'
import { list, put } from '@vercel/blob'
import { authOptions } from './auth/[...nextauth]'
import {
  MAX_LOOKBACK_DAYS,
  bucketByMonth,
  fetchMessageTraces,
  getGraphToken,
  graphConfig,
  groupTraces,
  keepRosterRelevant,
  monthKeyOf,
  resolveSyncRange,
  rowsToCsv,
} from '../../utils/graphTrace'

/**
 * Pull message trace from Microsoft Graph and write it to blob storage in the
 * same shape a hand-uploaded export ends up in.
 *
 * Runs nightly from the Vercel cron entry in vercel.json, and on demand from
 * the "Sync now" button in the file drawer.
 *
 * One blob per Santos calendar month, `mails/graph-YYYY-MM.csv`, rewritten in
 * full each run rather than appended to. Rewriting is what makes the job safely
 * repeatable: a run that half-finished, or a day Graph was slow, is corrected
 * by the next run instead of leaving a gap nobody notices.
 */

const PREFIX = 'mails/'

function fileFor(monthKey) {
  return `${PREFIX}graph-${monthKey}.csv`
}

export default async function handler(req, res) {
  // Vercel Cron authenticates with CRON_SECRET as a bearer token. An admin
  // session is accepted too so the drawer button works from the browser.
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Unauthorized' })
    if (!session.user?.isAdmin) {
      return res.status(403).json({ error: 'Only admins can trigger a sync' })
    }
  }

  const config = graphConfig()
  if (config.missing.length) {
    return res.status(500).json({
      error: `Graph sync is not configured. Missing: ${config.missing.join(', ')}`,
      setup: 'See docs/graph-sync.md',
    })
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not set' })
  }

  const days = Math.min(Number(req.query.days) || 0, MAX_LOOKBACK_DAYS)
  const force = req.query.force === '1'
  const now = Date.now()
  const range = resolveSyncRange(now, days)

  try {
    const token = await getGraphToken(config)
    const { traces, requests } = await fetchMessageTraces({
      token,
      fromMs: range.from,
      toMs: range.to,
    })

    const grouped = groupTraces(traces)
    const rows = keepRosterRelevant(grouped)
    const buckets = bucketByMonth(rows)

    // A month is only fully covered when the sync started at or before its
    // first day. The 90-day retention floor can cut into the oldest month.
    const partialFloorMonth = range.clampedByRetention ? monthKeyOf(range.from) : null

    const existing = new Set()
    if (partialFloorMonth) {
      const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
      blobs.forEach((blob) => existing.add(blob.pathname))
    }

    const written = []
    const skipped = []

    for (const [monthKey, monthRows] of buckets) {
      const pathname = fileFor(monthKey)

      // Never let a retention-truncated month overwrite a blob written back
      // when Graph still had the whole month. Older data does not come back.
      if (!force && monthKey === partialFloorMonth && existing.has(pathname)) {
        skipped.push({ month: monthKey, reason: 'would truncate an existing file', rows: monthRows.length })
        continue
      }

      const csv = rowsToCsv(monthRows)
      const blob = await put(pathname, csv, {
        access: 'public',
        contentType: 'text/csv',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      written.push({ month: monthKey, emails: monthRows.length, bytes: csv.length, url: blob.url })
    }

    const summary = {
      ok: true,
      from: new Date(range.from).toISOString(),
      to: new Date(range.to).toISOString(),
      traceRows: traces.length,
      emails: rows.length,
      droppedNoRosterParty: grouped.length - rows.length,
      graphRequests: requests,
      written,
      skipped,
      clampedByRetention: range.clampedByRetention,
    }
    console.log('Graph sync complete:', JSON.stringify(summary))
    return res.status(200).json(summary)
  } catch (error) {
    console.error('Graph sync failed:', error)
    return res.status(502).json({ error: error.message || 'Graph sync failed' })
  }
}
