import s from '../../styles/EmailAnalytics.module.css'

const PERIODS = [
  { id: 'all', label: 'All time', hint: 'Everything in the selected files' },
  { id: 'year', label: 'Year', hint: 'Last 365 days of data' },
  { id: 'month', label: 'Month', hint: 'Last 30 days of data' },
  { id: 'week', label: 'Week', hint: 'Last 7 days of data' },
]

const DIRECTIONS = [
  { id: 'all', label: 'All', hint: 'Sent by, or addressed to, each person' },
  { id: 'sent', label: 'Sent', hint: 'Emails each person sent' },
  { id: 'received', label: 'Received', hint: 'Emails each person was addressed on' },
]

const SCALES = [
  { id: 'shared', label: 'Shared' },
  { id: 'own', label: 'Per person' },
]

const VIEWS = [
  { id: 'both', label: 'Both' },
  { id: 'rows', label: 'Rows' },
  { id: 'grids', label: 'Grids' },
]

function Seg({ options, value, onChange, disabled, label }) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          title={option.hint}
          aria-pressed={value === option.id}
          disabled={disabled}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function ControlRail({
  period,
  onPeriod,
  direction,
  onDirection,
  scale,
  onScale,
  scaleDisabled,
  view,
  onView,
}) {
  return (
    <div className={s.rail}>
      <span className={s.lbl}>Period</span>
      <Seg label="Period" options={PERIODS} value={period} onChange={onPeriod} />
      <span className={`${s.lbl} ${s.gap}`}>Direction</span>
      <Seg label="Direction" options={DIRECTIONS} value={direction} onChange={onDirection} />
      <div className={s.spacer} />
      <span className={s.lbl}>Scale</span>
      <Seg
        label="Scale"
        options={SCALES}
        value={scale}
        onChange={onScale}
        disabled={scaleDisabled}
      />
      <span className={`${s.lbl} ${s.gap}`}>View</span>
      <Seg label="View" options={VIEWS} value={view} onChange={onView} />
    </div>
  )
}
