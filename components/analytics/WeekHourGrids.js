import s from '../../styles/EmailAnalytics.module.css'
import { isDarkStep, shade } from '../../utils/analytics'
import { initials } from '../../utils/roster'
import { DAY_NAMES, fmtInt, hourLabel, pct } from '../../utils/format'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const DEFAULT_VISIBLE = 12

function Card({ person, scaleMax, shareBase }) {
  const max = scaleMax || 1

  return (
    <div className={s.gcard}>
      <div className={s.gtop}>
        <span className={s.dot}>{initials(person.name)}</span>
        <span className={s.nm} title={person.email}>
          {person.name}
        </span>
        <span className={s.tt}>
          <b>{fmtInt(person.total)}</b>
          <span>{pct(person.total, shareBase)}% of all email</span>
        </span>
      </div>

      <div className={s.hm}>
        <span />
        {HOURS.map((hour) => (
          <span key={`h${hour}`} className={s.hh}>
            {hour % 2 === 0 ? String(hour).padStart(2, '0') : ''}
          </span>
        ))}
        <span />

        {person.matrix.map((row, day) => (
          <Row
            key={day}
            day={day}
            row={row}
            max={max}
            name={person.name}
            rowTotal={person.byWeekday[day]}
          />
        ))}

        <span className={s.cap}>total</span>
        {person.byHour.map((value, hour) => (
          <span key={`t${hour}`} className={s.ct} title={`${hourLabel(hour)} · ${fmtInt(value)}`}>
            {value > max * 0.35 ? fmtInt(value) : ''}
          </span>
        ))}
        <span className={s.rt}>{fmtInt(person.total)}</span>
      </div>

      <div className={s.gfoot}>
        <div>
          <span>Working window</span>{' '}
          <b>
            {person.firstHour >= 0
              ? `${hourLabel(person.firstHour)}–${hourLabel(person.lastHour)}`
              : '—'}
          </b>
        </div>
        <div>
          <span>Peak</span> <b>{person.peakHour >= 0 ? hourLabel(person.peakHour) : '—'}</b>
        </div>
        <div>
          <span>After hours</span> <b>{person.afterHoursPct}%</b>
        </div>
        <div>
          <span>Weekend</span> <b>{fmtInt(person.weekend)}</b>
        </div>
      </div>
    </div>
  )
}

function Row({ day, row, max, name, rowTotal }) {
  return (
    <>
      <span className={s.rl2}>{DAY_NAMES[day]}</span>
      {row.map((value, hour) => (
        <span
          key={hour}
          className={`${s.c}${isDarkStep(value, max) ? '' : ` ${s.lo}`}`}
          style={{ background: shade(value, max, hour) }}
          title={`${name} · ${DAY_NAMES[day]} ${hourLabel(hour)} · ${fmtInt(value)} emails`}
        >
          {/* Only the loud cells get a number, and only when it fits the cell —
              four digits do not, and the row and column margins carry those. */}
          {value > max * 0.5 && value < 1000 ? value : ''}
        </span>
      ))}
      <span className={s.rt}>{fmtInt(rowTotal)}</span>
    </>
  )
}

export default function WeekHourGrids({ result, scale, showAll, onShowAll }) {
  const { people, sharedMax, stats } = result
  const visible = showAll ? people : people.slice(0, DEFAULT_VISIBLE)
  const hidden = people.length - visible.length

  return (
    <div className={s.panel}>
      <div className={s.phead}>
        <div className={s.legend}>
          <span>
            {scale === 'shared'
              ? 'Shared scale — cells comparable between people'
              : 'Per person scale — shows each pattern, not each volume'}
          </span>
        </div>
      </div>
      <div className={s.gwrap}>
        {visible.map((person) => (
          <Card
            key={person.id}
            person={person}
            scaleMax={scale === 'shared' ? sharedMax : person.matrixMax}
            shareBase={stats.attributedTotal}
          />
        ))}
        {hidden > 0 ? (
          <div className={s.showAll}>
            <button type="button" className={s.solid} onClick={onShowAll}>
              Show all {people.length} people
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
