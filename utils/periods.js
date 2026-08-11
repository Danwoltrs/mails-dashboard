import { localFields, localMidnightMs } from './timezone'

/**
 * Period presets.
 *
 * Two kinds live side by side:
 *
 *  - Rolling: "the last N days", measured back from the anchor. This is what
 *    the dashboard has always done.
 *  - Calendar: "this week", "last quarter" — snapped to real Santos calendar
 *    boundaries, so a month means the 1st to the 1st and not 30 days.
 *
 * The anchor is the newest email in the current selection, NOT the wall clock.
 * That matters: exports arrive in batches, so the newest data is routinely
 * weeks or months behind today. Anchoring on the clock would make every
 * calendar preset render an empty dashboard until the day a fresh export lands.
 * Once the Graph sync is running daily the anchor sits within a day of now, and
 * "this week" quietly starts meaning the actual current week.
 *
 * Ranges are half-open — [from, to) — so adjacent periods never double-count a
 * message that lands exactly on a boundary. null means unbounded on that side.
 */

const DAY = 86400000

export const PERIOD_GROUPS = [
  {
    label: 'Rolling',
    options: [
      { id: 'all', label: 'All time', hint: 'Everything in the selected files' },
      { id: 'd7', label: 'Last 7 days', hint: '7 days back from the newest email' },
      { id: 'd30', label: 'Last 30 days', hint: '30 days back from the newest email' },
      { id: 'd90', label: 'Last 90 days', hint: '90 days back from the newest email' },
      { id: 'd365', label: 'Last 12 months', hint: '365 days back from the newest email' },
    ],
  },
  {
    label: 'Calendar',
    options: [
      { id: 'week', label: 'This week', hint: 'Sunday to Saturday, containing the newest email' },
      { id: 'weekPrev', label: 'Last week', hint: 'The full week before this one' },
      { id: 'month', label: 'This month', hint: 'Month to date' },
      { id: 'monthPrev', label: 'Last month', hint: 'The full previous calendar month' },
      { id: 'quarter', label: 'This quarter', hint: 'Quarter to date' },
      { id: 'quarterPrev', label: 'Last quarter', hint: 'The full previous calendar quarter' },
      { id: 'year', label: 'This year', hint: 'Year to date' },
      { id: 'yearPrev', label: 'Last year', hint: 'The full previous calendar year' },
    ],
  },
]

const BY_ID = new Map()
PERIOD_GROUPS.forEach((group) => {
  group.options.forEach((option) => BY_ID.set(option.id, option))
})

export const DEFAULT_PERIOD = 'all'

export function periodLabel(id) {
  return BY_ID.get(id)?.label || 'All time'
}

const ROLLING_DAYS = { d7: 7, d30: 30, d90: 90, d365: 365 }

/**
 * Resolve a preset to concrete epoch-millisecond bounds.
 *
 * Returns { from, to } with `from` inclusive and `to` exclusive; either may be
 * null for an open end. With no anchor (no data loaded yet) every preset
 * collapses to unbounded, which keeps the dashboard showing whatever it has
 * rather than blanking out.
 */
export function resolvePeriodRange(id, anchorMs) {
  if (!id || id === 'all' || !Number.isFinite(anchorMs)) return { from: null, to: null }

  const days = ROLLING_DAYS[id]
  if (days) return { from: anchorMs - days * DAY, to: null }

  const { year, month, day, weekday } = localFields(anchorMs)

  switch (id) {
    case 'week':
      return {
        from: localMidnightMs(year, month, day - weekday),
        to: localMidnightMs(year, month, day - weekday + 7),
      }
    case 'weekPrev':
      return {
        from: localMidnightMs(year, month, day - weekday - 7),
        to: localMidnightMs(year, month, day - weekday),
      }
    case 'month':
      return { from: localMidnightMs(year, month, 1), to: localMidnightMs(year, month + 1, 1) }
    case 'monthPrev':
      return { from: localMidnightMs(year, month - 1, 1), to: localMidnightMs(year, month, 1) }
    case 'quarter': {
      const q = Math.floor(month / 3) * 3
      return { from: localMidnightMs(year, q, 1), to: localMidnightMs(year, q + 3, 1) }
    }
    case 'quarterPrev': {
      const q = Math.floor(month / 3) * 3
      return { from: localMidnightMs(year, q - 3, 1), to: localMidnightMs(year, q, 1) }
    }
    case 'year':
      return { from: localMidnightMs(year, 0, 1), to: localMidnightMs(year + 1, 0, 1) }
    case 'yearPrev':
      return { from: localMidnightMs(year - 1, 0, 1), to: localMidnightMs(year, 0, 1) }
    default:
      return { from: null, to: null }
  }
}

/* ------------------------------------------------------------------ *
 * Display
 * ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayLabel(ms, withYear) {
  const { year, month, day } = localFields(ms)
  return withYear ? `${MONTHS[month]} ${day}, ${year}` : `${MONTHS[month]} ${day}`
}

/**
 * Human range for the resolved window, e.g. "Aug 1 – Aug 29, 2025".
 *
 * `to` is exclusive, so the last millisecond of the window is what gets
 * rendered — otherwise "this month" would read as ending on the 1st of the
 * next one. Open ends fall back to the data bounds so "All time" still shows
 * the span actually on screen.
 */
export function describeRange({ from, to }, bounds = {}) {
  const start = from ?? bounds.earliest
  const endExclusive = to ?? (Number.isFinite(bounds.latest) ? bounds.latest + 1 : null)
  if (!Number.isFinite(start) || !Number.isFinite(endExclusive)) return ''

  const end = endExclusive - 1
  if (end < start) return ''

  const a = localFields(start)
  const b = localFields(end)
  if (a.year === b.year && a.month === b.month && a.day === b.day) return dayLabel(start, true)
  return `${dayLabel(start, a.year !== b.year)} – ${dayLabel(end, true)}`
}
