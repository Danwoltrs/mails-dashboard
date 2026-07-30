import { DAY_NAMES, hourLabel } from './format'

function cell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Per-person aggregates as CSV — the same numbers the panels show.
 */
export function buildSummaryCsv(result, { period, direction }) {
  const header = [
    'name',
    'email',
    'emails',
    'share_pct',
    'peak_hour',
    'peak_count',
    'after_hours_pct',
    'after_hours_count',
    'weekend',
    'working_window',
    ...Array.from({ length: 24 }, (_, hour) => `h${String(hour).padStart(2, '0')}`),
    ...DAY_NAMES.map((day) => day.toLowerCase()),
  ]

  const total = result.stats.attributedTotal || 0
  const rows = result.people.map((person) => [
    person.name,
    person.email,
    person.total,
    total ? ((person.total / total) * 100).toFixed(1) : '0.0',
    person.peakHour >= 0 ? hourLabel(person.peakHour) : '',
    person.peakCount,
    person.afterHoursPct,
    person.afterHours,
    person.weekend,
    person.firstHour >= 0 ? `${hourLabel(person.firstHour)}-${hourLabel(person.lastHour)}` : '',
    ...person.byHour,
    ...person.byWeekday,
  ])

  const meta = [
    [`# period`, period],
    [`# direction`, direction],
    [`# emails`, result.stats.totalEmails],
    [`# timezone`, 'America/Sao_Paulo'],
  ]

  return [...meta, header, ...rows].map((row) => row.map(cell).join(',')).join('\n')
}

export function downloadSummaryCsv(result, options) {
  const csv = buildSummaryCsv(result, options)
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `email-analytics-${options.period}-${options.direction}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
