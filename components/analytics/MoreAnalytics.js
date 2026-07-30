import { useMemo, useState } from 'react'
import s from '../../styles/EmailAnalytics.module.css'
import EmployeeStats from './EmployeeStats'
import YearComparison from './YearComparison'
import DetailedBreakdown from './DetailedBreakdown'
import { buildYearComparison, toEmployeeBreakdown, toLegacyHeatmapData } from '../../utils/analytics'
import { DAY_NAMES } from '../../utils/format'

const COLORS = ['#059669', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#7c3aed', '#db2777', '#dc2626']

const TABS = [
  { id: 'employees', label: 'Employee stats' },
  { id: 'trends', label: 'Year comparison' },
  { id: 'breakdown', label: 'Detailed analysis' },
]

/**
 * The three pre-existing tabs, kept intact behind a collapsed section so the
 * comparison view owns the screen.
 */
export default function MoreAnalytics({ result, rows, latestMs }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('employees')
  const [selectedUsers, setSelectedUsers] = useState([])

  const heatmapData = useMemo(() => toLegacyHeatmapData(result), [result])
  const employeeBreakdown = useMemo(
    () => toEmployeeBreakdown(result, selectedUsers),
    [result, selectedUsers]
  )
  const yearComparison = useMemo(
    () => (open && activeTab === 'trends' ? buildYearComparison(rows, latestMs) : []),
    [open, activeTab, rows, latestMs]
  )

  const toggleUserSelection = (email) =>
    setSelectedUsers((prev) =>
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]
    )

  return (
    <div className={s.more}>
      <button
        type="button"
        className={s.moreBtn}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? '▾' : '▸'}</span> More analytics
      </button>

      {open ? (
        <div className={s.moreBody}>
          <div className={s.tabs} role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'employees' ? (
            <EmployeeStats
              selectedUsers={selectedUsers}
              toggleUserSelection={toggleUserSelection}
              clearUserSelection={() => setSelectedUsers([])}
              employeeBreakdown={employeeBreakdown}
              heatmapData={heatmapData}
              dayNames={DAY_NAMES}
              COLORS={COLORS}
            />
          ) : null}

          {activeTab === 'trends' ? <YearComparison yearComparison={yearComparison} /> : null}

          {activeTab === 'breakdown' ? (
            <DetailedBreakdown
              selectedUsers={selectedUsers}
              toggleUserSelection={toggleUserSelection}
              employeeBreakdown={employeeBreakdown}
              heatmapData={heatmapData}
              dayNames={DAY_NAMES}
              COLORS={COLORS}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
