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

// How far back a run with no explicit ?days reaches. Wide enough that a routine
// nightly run re-covers the previous month as well as the current one: the old
// behaviour pulled only the current month, so any month that went unsynced while
// the job was broken aged out of Graph's 90-day retention without ever being
// requested. Deliberately short of MAX_LOOKBACK_DAYS so routine runs stay small
// and never trip the retention floor — use ?days=90 for a deliberate backfill.
const DEFAULT_SYNC_DAYS = 45

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
    // A cron invocation arrives with no cookies, so it lands here whenever
    // CRON_SECRET is unset or stale — and then fails as a plain 401 that looks
    // exactly like a stranger knocking. Say which it was.
    if (!cronSecret) {
      console.error(
        'Graph sync: CRON_SECRET is not set. The nightly cron cannot authenticate and will 401 every night. See docs/graph-sync.md.'
      )
    } else if (authHeader.startsWith('Bearer ')) {
      console.error('Graph sync: bearer token did not match CRON_SECRET. Rejecting as unauthenticated.')
    }

    const session = await getServerSession(req, res, authOptions)
    if (!session) {
      console.error('Graph sync: rejected, no cron secret match and no signed-in session.')
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!session.user?.isAdmin) {
      console.error(`Graph sync: rejected, ${session.user?.email || 'user'} is not an admin.`)
      return res.status(403).json({ error: 'Only admins can trigger a sync' })
    }

    // The NextAuth session cookie is SameSite=Lax, so a plain GET from an
    // external page would carry it. Without this, an admin clicking a link could
    // be made to run a tenant-wide sync — with force=1, over the guard that
    // exists precisely because older data does not come back.
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Use POST to trigger a sync from a session' })
    }
  }

  const config = graphConfig()
  if (config.missing.length) {
    console.error(`Graph sync: not configured. Missing ${config.missing.join(', ')}.`)
    return res.status(500).json({
      error: `Graph sync is not configured. Missing: ${config.missing.join(', ')}`,
      setup: 'See docs/graph-sync.md',
    })
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Graph sync: BLOB_READ_WRITE_TOKEN is not set; nothing can be written.')
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not set' })
  }

  const requestedDays = Number(req.query.days)
  const days =
    Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(requestedDays, MAX_LOOKBACK_DAYS)
      : DEFAULT_SYNC_DAYS
  // Deliberately not a boolean. `force` gates exactly one thing: writing a month
  // the 90-day floor cuts into. Which month that is walks forward with the
  // calendar — May today, June next month — so a global flag means an override
  // copied from an earlier run, or from the docs, silently replaces a COMPLETE
  // month file with the handful of days still inside retention. Naming the month
  // makes a stale override a no-op instead of permanent data loss.
  const forceParam = String(req.query.force || '')
  const forcedMonth = /^\d{4}-\d{2}$/.test(forceParam) ? forceParam : null
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
      const pathname = fileFor(partialFloorMonth)
      const { blobs } = await list({ prefix: pathname, limit: 1 })
      blobs.forEach((blob) => existing.add(blob.pathname))
    }

    const written = []
    const skipped = []

    for (const [monthKey, monthRows] of buckets) {
      const pathname = fileFor(monthKey)

      // Never let a retention-truncated month overwrite a blob written back when
      // Graph still had the whole month, and never write a partial month under a
      // name that reads as complete. Older data does not come back either way.
      if (monthKey === partialFloorMonth && forcedMonth !== monthKey) {
        skipped.push({
          month: monthKey,
          reason: existing.has(pathname)
            ? `retention floor cuts into ${monthKey}; writing it would replace the existing complete file with coverage starting ${new Date(range.from).toISOString().slice(0, 10)}`
            : `retention floor cuts into ${monthKey}; it would only cover from ${new Date(range.from).toISOString().slice(0, 10)}`,
          coverageFrom: new Date(range.from).toISOString(),
          rows: monthRows.length,
          override: `?days=${days}&force=${monthKey}`,
        })
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
      // A run can time out mid-loop; without this there is no record anywhere of
      // which months actually landed.
      console.log(`Graph sync: wrote ${pathname} (${monthRows.length} emails, ${csv.length} bytes)`)
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
