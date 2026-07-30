import { generateEmailUniqueId } from './csv'
import { resolvePerson } from './roster'
import { parseUtcMs, localFields } from './timezone'

/**
 * Aggregation for the compact staff comparison view.
 *
 * Everything the UI shows derives from the Person shape built here — there is
 * no second query per panel.
 */

export const IN_HOURS_START = 7
export const IN_HOURS_END = 19

export function isAfterHours(hour) {
  return hour < IN_HOURS_START || hour > IN_HOURS_END
}

const GREEN = ['--g1', '--g2', '--g3', '--g4', '--g5']
const SLATE = ['--n1', '--n2', '--n3', '--n4', '--n5']

/**
 * Colour for one cell. In-hours uses the green ramp, outside 07–19h uses the
 * slate ramp: a message at 03:00 and one at 15:00 are not the same signal.
 * Zero is transparent, never step 1.
 */
export function shade(value, max, hour) {
  if (!value || !max) return 'transparent'
  const t = value / max
  const ramp = isAfterHours(hour) ? SLATE : GREEN
  const step = t < 0.08 ? 0 : t < 0.28 ? 1 : t < 0.52 ? 2 : t < 0.78 ? 3 : 4
  return `var(${ramp[step]})`
}

export function isDarkStep(value, max) {
  return !!max && value / max >= 0.52
}

/* ------------------------------------------------------------------ *
 * Per-row memos. Toggling period or direction re-walks every row, and
 * re-parsing timestamps / rebuilding dedup keys each time is the single most
 * expensive thing on a large merge. Cached on the row itself.
 * ------------------------------------------------------------------ */

function timestampOf(row) {
  let ms = row.__ms
  if (ms === undefined) {
    ms = parseUtcMs(row['date_time_utc'] || row['origin_timestamp_utc'])
    row.__ms = ms
  }
  return ms
}

function uniqueIdOf(row) {
  let id = row.__uid
  if (id === undefined) {
    id = generateEmailUniqueId(row)
    row.__uid = id
  }
  return id
}

function senderOf(row) {
  let sender = row.__sender
  if (sender === undefined) {
    sender = resolvePerson(row['sender_address'])
    row.__sender = sender
  }
  return sender
}

export const PERIOD_DAYS = { week: 7, month: 30, year: 365 }

/* ------------------------------------------------------------------ *
 * Recipient index
 *
 * Detail exports carry one row per Exchange event, so a single email spreads
 * its recipients over several rows. Dedup (correctly) keeps one row per
 * message, which would lose the rest of the recipient list — so the union is
 * indexed here from the pre-dedup rows, keyed by the same id dedup uses.
 *
 * Membership is a bitmask: a plain number while everyone fits in one 30-bit
 * word (the normal case), an array of words beyond that. No silent cap.
 * ------------------------------------------------------------------ */

export const BITS_PER_WORD = 30

export function createRecipientIndex() {
  return { mask: new Map(), people: [], bits: new Map() }
}

function bitFor(index, person) {
  let bit = index.bits.get(person.id)
  if (bit === undefined) {
    bit = index.people.length
    index.people.push(person)
    index.bits.set(person.id, bit)
  }
  return bit
}

function collect(index, value, words) {
  if (!value) return false
  let found = false
  for (const chunk of String(value).split(';')) {
    if (!chunk) continue
    const address = chunk.includes('##') ? chunk.slice(0, chunk.indexOf('##')) : chunk
    const person = resolvePerson(address)
    if (!person) continue
    const bit = bitFor(index, person)
    const word = (bit / BITS_PER_WORD) | 0
    while (words.length <= word) words.push(0)
    words[word] |= 1 << bit % BITS_PER_WORD
    found = true
  }
  return found
}

function mergeInto(index, key, words) {
  const previous = index.mask.get(key)
  if (previous === undefined) {
    index.mask.set(key, words.length === 1 ? words[0] : words.slice())
    return
  }
  if (typeof previous === 'number' && words.length === 1) {
    index.mask.set(key, previous | words[0])
    return
  }
  const merged = typeof previous === 'number' ? [previous] : previous.slice()
  for (let word = 0; word < words.length; word += 1) {
    merged[word] = (merged[word] || 0) | words[word]
  }
  index.mask.set(key, merged)
}

export function indexRecipients(rows, index) {
  if (!rows || !rows.length) return index
  const words = []
  for (const row of rows) {
    words.length = 0
    let found = collect(index, row['recipient_address'], words)
    found = collect(index, row['recipient_status'], words) || found
    found = collect(index, row['related_recipient_address'], words) || found
    if (!found) continue
    mergeInto(index, uniqueIdOf(row), words)
  }
  return index
}

/* ------------------------------------------------------------------ *
 * Bounds
 * ------------------------------------------------------------------ */

export function scanBounds(rows) {
  let earliest = null
  let latest = null
  let valid = 0
  if (rows) {
    for (const row of rows) {
      const ms = timestampOf(row)
      if (!Number.isFinite(ms)) continue
      valid += 1
      if (earliest === null || ms < earliest) earliest = ms
      if (latest === null || ms > latest) latest = ms
    }
  }
  return { earliest, latest, valid }
}

/* ------------------------------------------------------------------ *
 * Main aggregation
 * ------------------------------------------------------------------ */

function emptyPerson(person) {
  return {
    id: person.id,
    name: person.name,
    email: person.addresses[0],
    unlisted: !!person.unlisted,
    total: 0,
    byHour: new Array(24).fill(0),
    byWeekday: new Array(7).fill(0),
    matrix: Array.from({ length: 7 }, () => new Array(24).fill(0)),
  }
}

export function buildAnalytics({
  rows,
  recipientIndex = null,
  direction = 'all',
  period = 'all',
  latestMs = null,
} = {}) {
  const wantSent = direction === 'all' || direction === 'sent'
  const wantReceived = direction === 'all' || direction === 'received'

  const days = PERIOD_DAYS[period]
  const from = days && latestMs ? latestMs - days * 86400000 : null

  const accumulators = new Map()
  const teamHour = new Array(24).fill(0)
  const teamWeekday = new Array(7).fill(0)
  const teamMatrix = Array.from({ length: 7 }, () => new Array(24).fill(0))

  let distinctEmails = 0
  let attributedTotal = 0
  let skipped = 0

  const accFor = (person) => {
    let acc = accumulators.get(person.id)
    if (!acc) {
      acc = emptyPerson(person)
      accumulators.set(person.id, acc)
    }
    return acc
  }

  const bump = (person, weekday, hour) => {
    const acc = accFor(person)
    acc.total += 1
    acc.byHour[hour] += 1
    acc.byWeekday[weekday] += 1
    acc.matrix[weekday][hour] += 1
    teamHour[hour] += 1
    teamWeekday[weekday] += 1
    teamMatrix[weekday][hour] += 1
    attributedTotal += 1
  }

  let counted = false

  // Walks the set bits of one mask word and attributes to each recipient.
  const bumpWord = (bits, base, sender, weekday, hour) => {
    let remaining = bits
    while (remaining) {
      const lowest = remaining & -remaining
      remaining ^= lowest
      const person = recipientIndex.people[base + (31 - Math.clz32(lowest))]
      if (!person || (sender && person.id === sender.id)) continue
      bump(person, weekday, hour)
      counted = true
    }
  }

  for (const row of rows || []) {
    const ms = timestampOf(row)
    if (!Number.isFinite(ms)) {
      skipped += 1
      continue
    }
    if (from !== null && ms < from) continue

    const { hour, weekday } = localFields(ms)
    const sender = senderOf(row)
    counted = false

    if (wantSent && sender) {
      bump(sender, weekday, hour)
      counted = true
    }

    if (wantReceived && recipientIndex && recipientIndex.mask.size) {
      const mask = recipientIndex.mask.get(uniqueIdOf(row))
      if (typeof mask === 'number') {
        bumpWord(mask, 0, sender, weekday, hour)
      } else if (mask) {
        for (let word = 0; word < mask.length; word += 1) {
          bumpWord(mask[word], word * BITS_PER_WORD, sender, weekday, hour)
        }
      }
    }

    if (counted) distinctEmails += 1
  }

  const people = Array.from(accumulators.values())
  people.forEach((person) => {
    let peakHour = 0
    let peakCount = 0
    let afterHours = 0
    for (let hour = 0; hour < 24; hour += 1) {
      const value = person.byHour[hour]
      if (value > peakCount) {
        peakCount = value
        peakHour = hour
      }
      if (isAfterHours(hour)) afterHours += value
    }
    let matrixMax = 0
    for (let day = 0; day < 7; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        if (person.matrix[day][hour] > matrixMax) matrixMax = person.matrix[day][hour]
      }
    }
    const threshold = peakCount * 0.12
    let firstHour = -1
    let lastHour = -1
    for (let hour = 0; hour < 24; hour += 1) {
      if (person.byHour[hour] > threshold) {
        if (firstHour === -1) firstHour = hour
        lastHour = hour
      }
    }
    person.peakHour = peakCount > 0 ? peakHour : -1
    person.peakCount = peakCount
    person.hourMax = peakCount
    person.weekdayMax = Math.max(...person.byWeekday)
    person.matrixMax = matrixMax
    person.afterHours = afterHours
    person.afterHoursPct = person.total ? Math.round((afterHours / person.total) * 100) : 0
    person.weekend = person.byWeekday[0] + person.byWeekday[6]
    person.firstHour = firstHour
    person.lastHour = lastHour
  })

  people.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  const hourMax = Math.max(0, ...teamHour)
  let busiestHour = -1
  for (let hour = 0; hour < 24; hour += 1) {
    if (hourMax > 0 && teamHour[hour] === hourMax) {
      busiestHour = hour
      break
    }
  }
  let teamAfterHours = 0
  for (let hour = 0; hour < 24; hour += 1) {
    if (isAfterHours(hour)) teamAfterHours += teamHour[hour]
  }

  const team = {
    byHour: teamHour,
    byWeekday: teamWeekday,
    matrix: teamMatrix,
    total: attributedTotal,
    hourMax,
    weekdayMax: Math.max(0, ...teamWeekday),
    // A tick is "on" where the team total for that hour clears 35% of the
    // team's busiest hour — that is how deviation from the group reads
    // without a second chart.
    baseline: teamHour.map((value) => (hourMax > 0 ? value / hourMax > 0.35 : false)),
    peakHour: busiestHour,
    peakCount: hourMax,
    afterHours: teamAfterHours,
  }

  const activeStaff = people.length
  const stats = {
    totalEmails: distinctEmails,
    attributedTotal,
    activeStaff,
    averageEach: activeStaff ? Math.round(attributedTotal / activeStaff) : 0,
    busiestHour,
    busiestHourCount: hourMax,
    afterHours: teamAfterHours,
    afterHoursPct: attributedTotal ? Math.round((teamAfterHours / attributedTotal) * 100) : 0,
    skipped,
  }

  return {
    people,
    team,
    stats,
    sharedMax: Math.max(0, ...people.map((p) => p.matrixMax)),
    topTotal: people.length ? people[0].total : 0,
    periodFrom: from,
  }
}

/* ------------------------------------------------------------------ *
 * Adapters for the older tabs, which expect the previous data shape
 * ------------------------------------------------------------------ */

export function toLegacyHeatmapData(result) {
  const employeeStats = {}
  const userHeatmaps = {}
  result.people.forEach((person) => {
    employeeStats[person.email] = {
      total: person.total,
      byDay: person.byWeekday,
      byHour: person.byHour,
    }
    userHeatmaps[person.email] = person.matrix
  })
  return {
    heatmap: result.team.matrix,
    employeeStats,
    userHeatmaps,
    totalEmails: result.stats.attributedTotal,
    hourRange: [0, 23],
  }
}

export function toEmployeeBreakdown(result, selectedUsers = []) {
  return result.people.map((person) => ({
    email: person.email,
    count: person.total,
    name: person.name,
    isSelected: selectedUsers.includes(person.email),
  }))
}

export function buildYearComparison(rows, latestMs = null) {
  const basisYear = latestMs ? localFields(latestMs).year : new Date().getFullYear()
  const current = new Array(12).fill(0)
  const previous = new Array(12).fill(0)

  for (const row of rows || []) {
    if (!senderOf(row)) continue
    const ms = timestampOf(row)
    if (!Number.isFinite(ms)) continue
    const { year, month } = localFields(ms)
    if (year === basisYear) current[month] += 1
    else if (year === basisYear - 1) previous[month] += 1
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months.map((month, index) => ({
    month,
    thisYear: current[index],
    lastYear: previous[index],
  }))
}
