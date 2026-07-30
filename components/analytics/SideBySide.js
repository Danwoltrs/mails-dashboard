import { useMemo } from 'react'
import s from '../../styles/EmailAnalytics.module.css'
import { shade } from '../../utils/analytics'
import { initials } from '../../utils/roster'
import { DAY_INITIALS, DAY_NAMES, fmtInt, hourLabel, pct } from '../../utils/format'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

function ribbonHeight(value, max) {
  if (!max) return 3
  return Math.max(value ? 4 : 3, Math.round((value / max) * 22))
}

function Ribbon({ label, byHour, hourMax, peakHour, baseline }) {
  return (
    <>
      <div className={s.cells}>
        {HOURS.map((hour) => {
          const value = byHour[hour]
          return (
            <div
              key={hour}
              className={`${s.cell}${hour === peakHour ? ` ${s.pk}` : ''}`}
              style={{
                height: `${ribbonHeight(value, hourMax)}px`,
                background: shade(value, hourMax, hour),
              }}
              title={`${label} · ${hourLabel(hour)} · ${fmtInt(value)} emails`}
            />
          )
        })}
      </div>
      {baseline ? (
        <div className={s.avgline} aria-hidden="true">
          {baseline.map((on, hour) => (
            <i key={hour} className={on ? s.on : undefined} />
          ))}
        </div>
      ) : null}
    </>
  )
}

function DayStrip({ label, byWeekday, weekdayMax }) {
  return (
    <div className={s.dcells}>
      {byWeekday.map((value, day) => (
        <div
          key={day}
          className={s.dcell}
          style={{ background: shade(value, weekdayMax, 10) }}
          title={`${label} · ${DAY_NAMES[day]} · ${fmtInt(value)} emails`}
        >
          <em>{DAY_INITIALS[day]}</em>
        </div>
      ))}
    </div>
  )
}

export default function SideBySide({ result, sort, onSort }) {
  const { people, team, stats } = result

  const sorted = useMemo(() => {
    const list = [...people]
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.key === 'peak') list.sort((a, b) => (a.peakHour - b.peakHour) * dir)
    else if (sort.key === 'late') list.sort((a, b) => (a.afterHoursPct - b.afterHoursPct) * dir)
    else list.sort((a, b) => (a.total - b.total) * dir)
    return list
  }, [people, sort])

  const topTotal = people.length ? Math.max(...people.map((p) => p.total)) : 0
  const shareBase = stats.attributedTotal || 0

  const header = (key, label, extra) => {
    const active = sort.key === key
    return (
      <th
        className={`${extra || ''} ${s.sortable}${active ? ` ${s.sorted}` : ''}`}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        tabIndex={0}
        role="columnheader"
        onClick={() => onSort(key)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSort(key)
          }
        }}
      >
        {label}
        {active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div className={s.panel}>
      <div className={s.phead}>
        <div className={s.legend}>
          <span>Low</span>
          <span className={s.ramp}>
            <i style={{ background: 'var(--g1)' }} />
            <i style={{ background: 'var(--g2)' }} />
            <i style={{ background: 'var(--g3)' }} />
            <i style={{ background: 'var(--g4)' }} />
            <i style={{ background: 'var(--g5)' }} />
          </span>
          <span>High</span>
          <span className={s.ramp}>
            <i style={{ background: 'var(--n4)' }} />
          </span>
          <span>Outside 07–19h</span>
          <span className={s.ramp}>
            <i style={{ background: '#fff', boxShadow: 'inset 0 0 0 1.5px var(--brass)' }} />
          </span>
          <span>Peak</span>
        </div>
      </div>
      <div className={s.scroller}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.who}>Person</th>
              {header('volume', 'Emails', s.num)}
              <th className={s.hourcol}>
                <div className={s.hourhead}>
                  {HOURS.map((hour) => (
                    <span key={hour} className={hour % 6 === 0 ? s.q : undefined}>
                      {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
                    </span>
                  ))}
                </div>
              </th>
              <th className={s.days}>Day of week</th>
              {header('peak', 'Peak', s.peak)}
              {header('late', 'After hrs', s.late)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((person) => (
              <tr key={person.id}>
                <td className={s.who}>
                  <div className={s.whoRow}>
                    <span className={s.dot}>{initials(person.name)}</span>
                    <span className={s.nm} title={person.email}>
                      {person.name}
                    </span>
                  </div>
                </td>
                <td className={s.num}>
                  <span className={s.total}>{fmtInt(person.total)}</span>{' '}
                  <span className={s.share}>{pct(person.total, shareBase)}%</span>
                  <div className={s.bar}>
                    <i style={{ width: `${topTotal ? (person.total / topTotal) * 100 : 0}%` }} />
                  </div>
                </td>
                <td className={s.hourcol}>
                  <Ribbon
                    label={person.name}
                    byHour={person.byHour}
                    hourMax={person.hourMax}
                    peakHour={person.peakHour}
                    baseline={team.baseline}
                  />
                </td>
                <td className={s.days}>
                  <DayStrip
                    label={person.name}
                    byWeekday={person.byWeekday}
                    weekdayMax={person.weekdayMax}
                  />
                </td>
                <td className={s.peak}>
                  <b>{person.peakHour >= 0 ? hourLabel(person.peakHour) : '—'}</b>
                  <br />
                  <span className={s.share}>{fmtInt(person.peakCount)} emails</span>
                </td>
                <td className={s.late}>
                  <span className={`${s.pill}${person.afterHoursPct >= 22 ? ` ${s.hot}` : ''}`}>
                    {person.afterHoursPct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {people.length > 1 ? (
            <tfoot>
              <tr>
                <td className={s.who}>Team shape</td>
                <td className={s.num} />
                <td className={s.hourcol}>
                  <Ribbon
                    label="Team"
                    byHour={team.byHour}
                    hourMax={team.hourMax}
                    peakHour={-1}
                    baseline={null}
                  />
                </td>
                <td className={s.days}>
                  <DayStrip
                    label="Team"
                    byWeekday={team.byWeekday}
                    weekdayMax={team.weekdayMax}
                  />
                </td>
                <td className={s.peak} />
                <td className={s.late} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
