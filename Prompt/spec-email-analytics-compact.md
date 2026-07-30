# Email Analytics — compact staff comparison view

## Goal

Replace the current Email Analytics page layout with a compact comparison view.
Today every employee gets their own full-height 24×7 table stacked vertically, and
the CSV file manager permanently occupies the left third of the screen. Nothing is
actually comparable. The new layout puts all employees on one screen as single rows,
with the full week × hour grids available as a second view.

Visual target: `mockups/email-analytics-compact-v2.html` — read it first. It is a
static mockup with fake data, but the layout, spacing, colour ramps, scale logic and
interaction model are the spec. Match it. Do not redesign it.

## Confirm before building

- [ ] Repo / route this page lives on
- [ ] Where parsed CSV rows currently live (client state, IndexedDB, Supabase?)
- [ ] Whether the roster of employees is configured somewhere or inferred from sender addresses

Stop and ask if any of these are unclear rather than guessing.

## Keep

- Existing CSV upload, parse and dedup logic. **Do not touch the dedup.** It works.
- Existing file delete / select behaviour.
- The other tabs (Employee Stats, Year Comparison, Detailed Analysis) — untouched for now.

## Layout

Four regions, top to bottom:

1. **Top bar** (52px, dark green). Brand, page title, inline meta: total emails, files
   merged, last email date. Right side: `Manage files`, `Export`.
2. **Control rail** (single row). Period · Direction · Scale · View. All segmented
   controls, 11px labels. No large filter cards.
3. **Stat strip** (single row, hairline dividers, no boxes). Total emails · Active staff ·
   Average each · Busiest hour · Outside 07–19h.
4. **Content**: `Side by side` panel, then `Full week × hour` panel.

### File manager → drawer

Move the entire left sidebar into a right-side slide-over triggered by `Manage files`.
Contents unchanged: dropzone, file list with size / row count / date range, per-file
remove, select all / none. Closes on scrim click and Escape. The main content area is
full width at all times.

Drop the "How to Download Reports" instructions block from the main layout — put it
inside the drawer as a collapsible `How to export from Exchange` section.

### Panel 1 — Side by side

One table row per employee. Columns:

| Column | Content |
|---|---|
| Person | Initials avatar, name, role/team |
| Emails | Total, % of all email, bar relative to the highest person |
| Hour of day | 24 cells, gap 2px, width 16px. Height **and** colour both encode volume |
| Day of week | 7 cells, S–S labels underneath |
| Peak | Peak hour + count at that hour |
| After hrs | % outside 07:00–19:00, as a pill. Amber pill at ≥22% |

Under each hour ribbon: a row of grey ticks marking the team baseline (a tick is "on"
where the team total for that hour exceeds 35% of the team's busiest hour). This is how
deviation from the group reads without a second chart.

Table footer row: `Team shape` — the summed ribbon and day strip across everyone.

Rows are sortable by volume, peak hour, or after-hours share if easy; volume descending
is the default and is the only one that must work.

### Panel 2 — Full week × hour

One card per employee, laid out `repeat(auto-fit, minmax(420px, 1fr))` so three fit
side by side on a wide screen and stack cleanly on narrow.

Each card: weekdays as rows (7), hours as columns (24) — **not** the current
orientation. Row totals down the right edge, column totals along the bottom (rotated
vertical), grand total in the corner. Print the count inside a cell only when it is
above 50% of the scale max, so the grid stays quiet. Card footer: working window
(first–last hour above 12% of that person's peak), peak hour, after-hours %, weekend total.

## Scale toggle — get this right

`Shared` (default): every cell in every card is coloured against the maximum single
cell across **all** employees. Cards are then directly comparable — a lower-volume
person's grid stays visibly lighter.

`Per person`: each card is normalised to that person's own maximum. Shows the shape of
someone's day independent of volume.

Same toggle also affects nothing in Panel 1 (ribbons there are always per-person, since
height already carries the comparison). Label under the panel header updates to say
which mode is active and what it means.

## Colour

Two ramps, five steps each. In-hours (07:00–19:00) uses the green ramp, outside those
hours uses the slate/blue ramp. This is deliberate: a message at 03:00 and one at 15:00
are not the same signal, and the current version renders them identically.

```
green:  #E6EEE9  #BEDACB  #8CC0A6  #4E9B79  #186B4E
slate:  #E7EAF1  #C4CDE0  #96A6C6  #5F79A6  #3A5788
```

Bucket thresholds as fraction of scale max: `<.08 → 1, <.28 → 2, <.52 → 3, <.78 → 4, else 5`.
Zero renders transparent, not step 1. Peak cell in Panel 1 gets a 1.5px inset brass ring
(`#A8791F`), nothing else.

Take the exact CSS variables from the mockup rather than re-deriving them.

## Data

### Timezone — likely bug in the current version

Exchange message trace exports timestamps in **UTC**. Every hour-of-day and day-of-week
bucket must be converted to `America/Sao_Paulo` before aggregating, or the whole heatmap
is shifted three hours and late-evening activity lands on the wrong day. Check what the
current code does; if it buckets on the raw timestamp, fix it and note the fix.

### Per-employee shape

```ts
type Person = {
  name: string
  role: string
  total: number
  byHour: number[]        // length 24, local time
  byWeekday: number[]     // length 7, index 0 = Sunday
  matrix: number[][]       // [7][24], weekday × hour
  peakHour: number
  peakCount: number
  afterHours: number      // count where hour < 7 || hour > 19
}
```

Everything else in the UI derives from this — no separate queries per panel.

### Roster

Employees resolve from a configured list of internal addresses, not from whatever
appears in the CSV. Aliases and old addresses map to one person. "Active staff" counts
people in the roster with at least one email in the selected period. Anything from an
address not in the roster is excluded from these panels entirely — it does not become
an "Unknown" row.

## Empty and edge states

- No files uploaded → single centred prompt in the content area with the dropzone, drawer
  open by default. Not an empty table.
- One employee → panels still render, "Team shape" row hides, scale toggle disabled.
- More than ~12 employees → Panel 1 is still fine; Panel 2 grid wraps. No change needed,
  but don't let Panel 2 render 40 cards without a "show all" guard.
- Employee with a total but an all-zero hour bucket → do not divide by zero.

## Done when

- [ ] Full-width content, file manager only visible when opened
- [ ] Three employees fit on one screen at 1440×900 with both panels visible
- [ ] Shared scale makes the lowest-volume person visibly lighter than the highest
- [ ] After-hours cells are blue everywhere they appear
- [ ] Hour buckets match Santos local time (spot-check one known late email)
- [ ] Row totals in Panel 2 equal `byWeekday`; column totals equal `byHour`; both sum to `total`
- [ ] Keyboard: drawer trap + Escape, visible focus on all segmented controls
- [ ] Tooltips on every cell: person · time · count
- [ ] Existing dedup output unchanged — same total as before the refactor

## Out of scope

Chart libraries. Everything here is divs and CSS grid; the mockup proves it. No Recharts,
no D3, no canvas.
