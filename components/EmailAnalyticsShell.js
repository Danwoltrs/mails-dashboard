import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import s from '../styles/EmailAnalytics.module.css'
import TopBar from './analytics/TopBar'
import ControlRail from './analytics/ControlRail'
import StatStrip from './analytics/StatStrip'
import SideBySide from './analytics/SideBySide'
import WeekHourGrids from './analytics/WeekHourGrids'
import FileDrawer from './analytics/FileDrawer'
import MoreAnalytics from './analytics/MoreAnalytics'
import { buildAnalytics, scanBounds } from '../utils/analytics'
import { DEFAULT_PERIOD, describeRange } from '../utils/periods'
import { downloadSummaryCsv } from '../utils/exportSummary'
import { useEmailData } from '../utils/useEmailData'
import { fmtInt } from '../utils/format'

const DEFAULT_SORT_DIR = { volume: 'desc', peak: 'asc', late: 'desc' }

export default function EmailAnalyticsShell({ session, onOpenAdmin }) {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [period, setPeriod] = useState(DEFAULT_PERIOD)
  const [direction, setDirection] = useState('all')
  const [scale, setScale] = useState('shared')
  const [view, setView] = useState('both')
  const [sort, setSort] = useState({ key: 'volume', dir: 'desc' })
  const [showAllGrids, setShowAllGrids] = useState(false)
  const autoOpened = useRef(false)

  const filesRef = useRef([])
  const selectedRef = useRef([])
  filesRef.current = files
  selectedRef.current = selected

  const loadFiles = useCallback(async () => {
    setFilesLoading(true)
    try {
      const response = await fetch('/api/list-csv-files')
      if (!response.ok) throw new Error('Failed to list files')
      const payload = await response.json()
      const next = payload.files || []
      const prevFiles = filesRef.current
      const prevSelected = selectedRef.current
      const everythingWasSelected =
        prevFiles.length > 0 && prevSelected.length === prevFiles.length

      setFiles(next)
      if (!prevFiles.length || everythingWasSelected) {
        setSelected(next)
      } else {
        const keep = new Set(prevSelected.map((file) => file.name))
        setSelected(next.filter((file) => keep.has(file.name)))
      }
    } catch (error) {
      console.error('Error loading CSV files:', error)
    } finally {
      setFilesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // No files at all: open the drawer so the dropzone is the first thing seen.
  useEffect(() => {
    if (filesLoading || autoOpened.current) return
    if (!files.length) {
      autoOpened.current = true
      setDrawerOpen(true)
    }
  }, [filesLoading, files.length])

  const { data, recipientIndex, loading, error, progress } = useEmailData(selected)

  const bounds = useMemo(() => scanBounds(data?.rows), [data])

  const result = useMemo(
    () =>
      buildAnalytics({
        rows: data?.rows || [],
        recipientIndex,
        direction,
        period,
        latestMs: bounds.latest,
      }),
    [data, recipientIndex, direction, period, bounds.latest]
  )

  const periodRange = useMemo(
    () => describeRange({ from: result.periodFrom, to: result.periodTo }, bounds),
    [result.periodFrom, result.periodTo, bounds]
  )

  const dedup = data?.deduplicationStats
    ? data.isFiltered
      ? data.deduplicationStats.filtered
      : data.deduplicationStats.unfiltered
    : null

  const onSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_SORT_DIR[key] }
    )

  const handleToggle = (file) =>
    setSelected((prev) =>
      prev.some((item) => item.name === file.name)
        ? prev.filter((item) => item.name !== file.name)
        : [...prev, file]
    )

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete ${filename}? This cannot be undone.`)) return
    try {
      const response = await fetch(`/api/delete-csv?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        window.alert(`Failed to delete file: ${payload.error || response.statusText}`)
        return
      }
      setSelected((prev) => prev.filter((item) => item.name !== filename))
      setFiles((prev) => prev.filter((item) => item.name !== filename))
      loadFiles()
    } catch (deleteError) {
      console.error('Delete error:', deleteError)
      window.alert('Failed to delete file')
    }
  }

  const hasPeople = result.people.length > 0
  const showRows = view !== 'grids'
  const showGrids = view !== 'rows'

  let body = null
  if (error) {
    body = <div className={s.error}>{error}</div>
  } else if (filesLoading) {
    body = (
      <div className={s.empty}>
        <b>Loading files</b>
      </div>
    )
  } else if (!files.length) {
    body = (
      <div className={s.empty}>
        <b>No CSV exports yet</b>
        Drop an Exchange message trace export into the file drawer to get started.
        <div className={s.cta}>
          <button type="button" className={s.solid} onClick={() => setDrawerOpen(true)}>
            Open file drawer
          </button>
        </div>
      </div>
    )
  } else if (!selected.length) {
    body = (
      <div className={s.empty}>
        <b>Nothing selected</b>
        Pick at least one file in the drawer.
        <div className={s.cta}>
          <button type="button" className={s.solid} onClick={() => setDrawerOpen(true)}>
            Choose files
          </button>
        </div>
      </div>
    )
  } else if (loading) {
    body = (
      <div className={s.empty}>
        <b>Reading exports</b>
        {progress ? `Parsed ${progress.done} of ${progress.total} files` : 'Loading…'}
      </div>
    )
  } else if (!hasPeople) {
    body = (
      <div className={s.empty}>
        <b>No roster activity in this selection</b>
        {fmtInt(data?.rows?.length || 0)} emails were read, but none resolved to a person in the
        roster. Check utils/roster.js.
      </div>
    )
  } else {
    body = (
      <>
        {showRows ? <SideBySide result={result} sort={sort} onSort={onSort} /> : null}
        {showGrids ? (
          <WeekHourGrids
            result={result}
            scale={result.people.length > 1 ? scale : 'own'}
            showAll={showAllGrids}
            onShowAll={() => setShowAllGrids(true)}
          />
        ) : null}
        <MoreAnalytics result={result} rows={data?.rows || []} latestMs={bounds.latest} />
      </>
    )
  }

  return (
    <div className={s.page}>
      <TopBar
        session={session}
        totalEmails={dedup?.uniqueCount ?? data?.rows?.length ?? 0}
        fileCount={data?.fileCount ?? selected.length}
        lastEmailDate={bounds.latest ? new Date(bounds.latest) : null}
        onManageFiles={() => setDrawerOpen(true)}
        onExport={() => downloadSummaryCsv(result, { period, direction, periodRange })}
        canExport={hasPeople}
        onOpenAdmin={onOpenAdmin}
      />

      <ControlRail
        period={period}
        onPeriod={setPeriod}
        periodRange={periodRange}
        periodAnchor={bounds.latest}
        direction={direction}
        onDirection={setDirection}
        scale={scale}
        onScale={setScale}
        scaleDisabled={result.people.length < 2}
        view={view}
        onView={setView}
      />

      <StatStrip stats={result.stats} duplicatesRemoved={dedup?.duplicatesRemoved || 0} />

      <main className={s.main}>{body}</main>

      <FileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        files={files}
        selected={selected}
        onToggle={handleToggle}
        onSelectAll={() => setSelected(files)}
        onSelectNone={() => setSelected([])}
        onDelete={handleDelete}
        onUploaded={loadFiles}
        loading={filesLoading}
        isAdmin={!!session?.user?.isAdmin}
      />
    </div>
  )
}
