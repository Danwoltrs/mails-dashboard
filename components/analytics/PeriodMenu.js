import { useEffect, useRef, useState } from 'react'
import s from '../../styles/EmailAnalytics.module.css'
import { PERIOD_GROUPS, periodLabel } from '../../utils/periods'

/**
 * Period picker.
 *
 * A dropdown rather than another segmented control: the rail already carries
 * Direction, Scale and View, and thirteen presets laid out flat would push it
 * onto a second row on any laptop screen.
 *
 * The resolved window is printed under the button. Presets are anchored on the
 * newest email rather than the wall clock (see utils/periods.js), so without
 * that line "This week" would be quietly ambiguous.
 */
export default function PeriodMenu({ value, onChange, range }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={s.periodWrap} ref={wrapRef}>
      <button
        type="button"
        className={s.periodBtn}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {periodLabel(value)} ▾
      </button>
      {range ? <span className={s.periodRange}>{range}</span> : null}

      {open ? (
        <div className={s.periodPanel} role="menu">
          {PERIOD_GROUPS.map((group) => (
            <div key={group.label} className={s.periodGroup}>
              <div className={s.periodGroupLabel}>{group.label}</div>
              <div className={s.periodGrid}>
                {group.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={value === option.id}
                    title={option.hint}
                    className={`${s.periodItem} ${value === option.id ? s.periodItemOn : ''}`}
                    onClick={() => {
                      onChange(option.id)
                      setOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
