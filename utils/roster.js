/**
 * Staff roster.
 *
 * Employees resolve from THIS file, not from whatever happens to appear in the
 * CSV exports. Anything from an address that does not resolve to a person here
 * is excluded from the analytics panels entirely — it never becomes an
 * "Unknown" row.
 *
 * ---------------------------------------------------------------------------
 * EDIT ME: `name` is what the dashboard displays. Add surnames, fix accents,
 * and list old / alias addresses under `addresses` so one person stays one row
 * after a mailbox rename.
 * ---------------------------------------------------------------------------
 */

// Domains treated as internal. Used for the auto-discovery fallback below.
export const INTERNAL_DOMAINS = ['wolthers.com']

// Shared mailboxes, distribution lists and role addresses. Never rendered as a
// person. wolthers@wolthers.com shows up in exports as "##Receive, Expand" — a
// list, not a mailbox.
export const EXCLUDED_ADDRESSES = [
  'wolthers@wolthers.com',
  'trading@wolthers.com',
  'trading1@wolthers.com',
  'contracts@wolthers.com',
  'contract@wolthers.com',
  'fixation@wolthers.com',
  'fixation-old@wolthers.com',
  'fixations@wolthers.com',
  'fixing@wolthers.com',
  'qualitycontrol@wolthers.com',
  'finance@wolthers.com',
  'financeiro@wolthers.com',
  'minasul@wolthers.com',
  'info@wolthers.com',
  'noreply@wolthers.com',
]

// Sorted by first name. `sends` is a note on what the current exports contain:
// the message trace exports only capture outbound mail from a few mailboxes, so
// everyone else appears as a recipient only.
export const ROSTER = [
  { id: 'ana', name: 'Ana', addresses: ['ana@wolthers.com'] },
  { id: 'anderson', name: 'Anderson', addresses: ['anderson@wolthers.com'] },
  { id: 'caio', name: 'Caio', addresses: ['caio@wolthers.com'] },
  { id: 'caroline', name: 'Caroline', addresses: ['caroline@wolthers.com'] },
  { id: 'daniel', name: 'Daniel', addresses: ['daniel@wolthers.com'] },
  { id: 'debora', name: 'Débora', addresses: ['debora@wolthers.com'] },
  { id: 'diego', name: 'Diego', addresses: ['diego@wolthers.com'] },
  { id: 'edgar', name: 'Edgar', addresses: ['edgar@wolthers.com'] },
  { id: 'felipe', name: 'Felipe', addresses: ['felipe@wolthers.com'] },
  { id: 'hector', name: 'Hector', addresses: ['hector@wolthers.com'] },
  { id: 'karina', name: 'Karina', addresses: ['karina@wolthers.com'] },
  { id: 'katia', name: 'Katia', addresses: ['katia@wolthers.com'] },
  { id: 'kauan', name: 'Kauan', addresses: ['kauan@wolthers.com'] },
  { id: 'matheus', name: 'Matheus', addresses: ['matheus@wolthers.com'] },
  { id: 'michelle', name: 'Michelle', addresses: ['michelle@wolthers.com'] },
  { id: 'natalia', name: 'Natalia', addresses: ['natalia@wolthers.com'] },
  { id: 'patricia', name: 'Patrícia', addresses: ['patricia@wolthers.com'] },
  { id: 'rasmus', name: 'Rasmus', addresses: ['rasmus@wolthers.com'] },
  { id: 'rhafael', name: 'Rhafael', addresses: ['rhafael@wolthers.com'] },
  { id: 'sabino', name: 'Sabino', addresses: ['sabino@wolthers.com'] },
  { id: 'sandra', name: 'Sandra', addresses: ['sandra@wolthers.com'] },
  { id: 'sofia', name: 'Sofia Velez', addresses: ['sofia.velez@wolthers.com'] },
  { id: 'svenn', name: 'Svenn', addresses: ['svenn@wolthers.com'] },
  { id: 'tom', name: 'Tom', addresses: ['tom@wolthers.com'] },
  { id: 'valeria', name: 'Valeria', addresses: ['valeria@wolthers.com'] },
  { id: 'victor', name: 'Victor', addresses: ['victor@wolthers.com'] },
  { id: 'vinicius', name: 'Vinicius', addresses: ['vinicius@wolthers.com'] },
  { id: 'wellton', name: 'Wellton', addresses: ['wellton@wolthers.com'] },
]

/**
 * When true, a mailbox on an internal domain that is not listed above still
 * shows up (named from its address) instead of silently disappearing — so a new
 * hire appears the day their first export lands. Set to false to show only the
 * addresses listed in ROSTER.
 */
export const INCLUDE_UNLISTED_INTERNAL = true

const byAddress = new Map()
ROSTER.forEach((person) => {
  person.addresses.forEach((address) => byAddress.set(address.trim().toLowerCase(), person))
})

const excluded = new Set(EXCLUDED_ADDRESSES.map((a) => a.trim().toLowerCase()))
const discovered = new Map()

function titleCase(value) {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Resolve an email address to a roster person, or null when the address is not
 * one of ours. Returned objects are stable (same object for the same address)
 * so they can be used as map keys.
 */
export function resolvePerson(address) {
  if (!address) return null

  // Exports carry plain addresses, but also "Display Name <addr@domain>" and
  // stray quotes. Without this, one mailbox can split into several rows.
  let raw = String(address).trim().toLowerCase()
  const bracket = raw.lastIndexOf('<')
  if (bracket !== -1) raw = raw.slice(bracket + 1)
  raw = raw.replace(/[<>"';,]/g, '').trim()

  const at = raw.indexOf('@')
  if (at <= 0) return null
  if (excluded.has(raw)) return null

  const listed = byAddress.get(raw)
  if (listed) return listed
  if (!INCLUDE_UNLISTED_INTERNAL) return null

  const domain = raw.slice(at + 1)
  if (!INTERNAL_DOMAINS.includes(domain)) return null

  let person = discovered.get(raw)
  if (!person) {
    person = { id: raw, name: titleCase(raw.slice(0, at)), addresses: [raw], unlisted: true }
    discovered.set(raw, person)
  }
  return person
}

export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
