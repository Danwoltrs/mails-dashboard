// Small shared formatters for the analytics UI.

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function fmtInt(n) {
  return Number(n || 0).toLocaleString('en-US')
}

export function hourLabel(hour) {
  if (hour == null || hour < 0) return '—'
  return `${String(hour).padStart(2, '0')}:00`
}

export function pct(part, whole, digits = 1) {
  if (!whole) return '0'
  return ((part / whole) * 100).toFixed(digits)
}

export function fmtDay(date) {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtKb(bytes) {
  if (!bytes) return '0 KB'
  return `${Math.round(bytes / 1024).toLocaleString('en-US')} KB`
}

// Data older than this reads as "current" to anyone glancing at the dashboard,
// so past it the age gets said out loud rather than left to be inferred.
export const STALE_AFTER_DAYS = 7

/**
 * How far behind now the newest email is, in plain words: "11 months old".
 *
 * Returns null while the data is fresh. Every period preset is measured from
 * the newest email rather than the wall clock, so when that anchor is a year
 * behind, "Last 30 days" silently means a month in 2025 — this is what stops
 * that from being a trap.
 */
export function describeStaleness(latestMs, nowMs = Date.now()) {
  if (!Number.isFinite(latestMs)) return null
  const days = Math.floor((nowMs - latestMs) / 86400000)
  if (days < STALE_AFTER_DAYS) return null
  if (days < 60) return `${days} days old`
  const months = Math.round(days / 30.44)
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} old`
  const years = (days / 365.25).toFixed(1).replace(/\.0$/, '')
  return `${years} years old`
}
