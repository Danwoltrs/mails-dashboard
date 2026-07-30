import s from '../../styles/EmailAnalytics.module.css'
import { fmtInt, hourLabel } from '../../utils/format'

function Stat({ label, value, note }) {
  return (
    <div className={s.stat}>
      <em>{label}</em>
      <b>{value}</b>
      {note ? <small>{note}</small> : null}
    </div>
  )
}

export default function StatStrip({ stats, duplicatesRemoved }) {
  return (
    <div className={s.strip}>
      <Stat
        label="Total emails"
        value={fmtInt(stats.totalEmails)}
        note={duplicatesRemoved ? `${fmtInt(duplicatesRemoved)} duplicates removed` : null}
      />
      <Stat label="Active staff" value={fmtInt(stats.activeStaff)} />
      <Stat label="Average each" value={fmtInt(stats.averageEach)} />
      <Stat
        label="Busiest hour"
        value={stats.busiestHour >= 0 ? hourLabel(stats.busiestHour) : '—'}
        note={stats.busiestHourCount ? `${fmtInt(stats.busiestHourCount)} emails` : null}
      />
      <Stat
        label="Outside 07–19h"
        value={`${stats.afterHoursPct}%`}
        note={`${fmtInt(stats.afterHours)} emails`}
      />
    </div>
  )
}
