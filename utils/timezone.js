/**
 * Exchange message trace exports timestamps in UTC (the columns are literally
 * named date_time_utc / origin_timestamp_utc). Every hour-of-day and
 * day-of-week bucket has to be converted to Santos local time before
 * aggregating, otherwise the whole heatmap sits three hours off and
 * late-evening activity lands on the wrong day.
 */

export const TIME_ZONE = 'America/Sao_Paulo'

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
const ZONE_SUFFIX = /([+-])(\d{2}):?(\d{2})$/

/**
 * Parse an export timestamp to epoch milliseconds. Values with no zone marker
 * are treated as UTC, which is what these columns hold.
 */
export function parseUtcMs(value) {
  if (!value) return NaN
  const text = String(value).trim()
  if (!text) return NaN

  const m = ISO.exec(text)
  if (m) {
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0)
    const zone = ZONE_SUFFIX.exec(text)
    if (zone) {
      const sign = zone[1] === '-' ? -1 : 1
      return ms - sign * (+zone[2] * 60 + +zone[3]) * 60000
    }
    return ms
  }

  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? NaN : parsed
}

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

// Offsets are cached per UTC day: one Intl call per day of data instead of one
// per row. Brazil dropped DST in 2019, so the offset is constant inside a day
// for anything these exports contain.
const offsetCache = new Map()

function offsetMsFor(ms) {
  const day = Math.floor(ms / 86400000)
  let offset = offsetCache.get(day)
  if (offset === undefined) {
    const parts = {}
    for (const part of formatter.formatToParts(new Date(ms))) parts[part.type] = part.value
    const local = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour % 24,
      +parts.minute,
      +parts.second
    )
    offset = Math.round((local - (ms - (ms % 1000))) / 60000) * 60000
    offsetCache.set(day, offset)
  }
  return offset
}

/**
 * Local (Santos) calendar fields for a UTC instant.
 */
export function localFields(ms) {
  const shifted = new Date(ms + offsetMsFor(ms))
  return {
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  }
}

/**
 * Inverse of localFields: the UTC instant of local midnight on a given local
 * calendar date. Month and day roll over the way Date.UTC does, so
 * localMidnightMs(2026, 12, 1) is January 1st 2027 and
 * localMidnightMs(2026, 0, 0) is December 31st 2025 — which is what makes the
 * quarter and month arithmetic in utils/periods.js safe at year boundaries.
 *
 * The offset depends on the instant we are looking for, so it is applied twice:
 * the first pass gets us within a day, the second lands exactly. Brazil has had
 * no DST since 2019, so in practice the first pass is already correct.
 */
export function localMidnightMs(year, month, day = 1) {
  const wall = Date.UTC(year, month, day)
  const first = wall - offsetMsFor(wall)
  return wall - offsetMsFor(first)
}
