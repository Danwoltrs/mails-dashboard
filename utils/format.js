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
