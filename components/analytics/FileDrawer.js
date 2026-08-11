import { useEffect, useRef, useState } from 'react'
import s from '../../styles/EmailAnalytics.module.css'
import { useCsvUpload } from '../../utils/useCsvUpload'
import { fmtDay, fmtInt, fmtKb } from '../../utils/format'

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

function fileMeta(file) {
  const size = fmtKb(file.size)
  if (file.dateRange?.earliest && file.dateRange?.latest) {
    const from = fmtDay(file.dateRange.earliest)
    const to = fmtDay(file.dateRange.latest)
    return `${size} · ${from === to ? from : `${from} – ${to}`}`
  }
  return `${size} · ${fmtInt(file.recordCount || 0)} rows`
}

export default function FileDrawer({
  open,
  onClose,
  files,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  onDelete,
  onUploaded,
  loading,
  isAdmin,
}) {
  const drawerRef = useRef(null)
  const restoreRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [showHowto, setShowHowto] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState(null)
  const { uploading, preparing, progress, message, queue, currentIndex, upload } =
    useCsvUpload(onUploaded)

  const runSync = async () => {
    setSyncing(true)
    setSyncNote(null)
    try {
      const response = await fetch('/api/sync-graph', { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSyncNote({ error: true, text: payload.error || `Sync failed (${response.status})` })
        return
      }
      const months = (payload.written || []).map((entry) => entry.month).join(', ')
      setSyncNote({
        error: false,
        text: months
          ? `Synced ${fmtInt(payload.emails || 0)} emails into ${months}`
          : 'Sync ran, nothing new to write',
      })
      onUploaded()
    } catch (error) {
      setSyncNote({ error: true, text: error.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!open) return undefined

    restoreRef.current = document.activeElement
    const node = drawerRef.current
    const first = node?.querySelector(FOCUSABLE)
    if (first) first.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      )
      if (!items.length) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const restore = restoreRef.current
      if (restore && typeof restore.focus === 'function') restore.focus()
    }
  }, [open, onClose])

  const selectedNames = new Set(selected.map((file) => file.name))

  return (
    <>
      <div className={`${s.scrim}${open ? ` ${s.on}` : ''}`} onClick={onClose} />
      <aside
        ref={drawerRef}
        className={`${s.drawer}${open ? ` ${s.on}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Manage files"
        aria-hidden={!open}
      >
        <div className={s.dhead}>
          <h2>Files</h2>
          <span className={`${s.share} ${s.pushRight}`}>
            {selected.length} of {files.length} selected
          </span>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div
          className={`${s.drop}${dragging ? ` ${s.dragging}` : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (event.dataTransfer.files?.length) upload(event.dataTransfer.files)
          }}
        >
          <input
            type="file"
            accept=".csv"
            multiple
            disabled={uploading}
            aria-label="Upload CSV exports"
            onChange={(event) => {
              if (event.target.files?.length) upload(event.target.files)
              event.target.value = ''
            }}
          />
          {uploading ? (
            <>
              <b>
                {preparing ? 'Condensing' : 'Uploading'} {currentIndex + 1} of {queue.length}
              </b>
              {queue[currentIndex]?.name}
              <div className={s.progress}>
                <i style={{ width: `${Math.round(progress)}%` }} />
              </div>
            </>
          ) : (
            <>
              <b>Drop CSV exports here</b>
              Any size · condensed in your browser before upload
            </>
          )}
        </div>

        {message ? <p className={s.dnote}>{message}</p> : null}

        {isAdmin ? (
          <div className={s.syncBox}>
            <div className={s.syncRow}>
              <b>Automatic sync</b>
              <button
                type="button"
                className={s.link}
                onClick={runSync}
                disabled={syncing || uploading}
              >
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
            <p className={s.dnote}>
              Pulls message trace straight from Microsoft Graph each night. Covers the last 90
              days only — older months stay as uploaded files.
            </p>
            {syncNote ? (
              <p className={`${s.dnote}${syncNote.error ? ` ${s.dnoteBad}` : ''}`}>
                {syncNote.text}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={s.dtools}>
          <button type="button" className={s.link} onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" className={s.link} onClick={onSelectNone}>
            None
          </button>
        </div>

        <div className={s.flist}>
          {loading ? <p className={s.dnote}>Loading files…</p> : null}
          {!loading && !files.length ? <p className={s.dnote}>No CSV files uploaded yet.</p> : null}
          {files.map((file) => {
            const isSelected = selectedNames.has(file.name)
            return (
              <div className={s.f} key={file.name}>
                <button
                  type="button"
                  className={s.fn}
                  aria-pressed={isSelected}
                  onClick={() => onToggle(file)}
                  title={file.name}
                >
                  <span className={s.fnRow}>
                    <span className={`${s.chk}${isSelected ? '' : ` ${s.off}`}`} aria-hidden="true">
                      ✓
                    </span>
                    <span className={s.fnText}>
                      <span className={s.fnName}>{file.name}</span>
                      <span className={s.fnMeta}>{fileMeta(file)}</span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={s.x}
                  onClick={() => onDelete(file.name)}
                  aria-label={`Remove ${file.name}`}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>

        <div className={s.howto}>
          <button
            type="button"
            className={s.moreBtn}
            aria-expanded={showHowto}
            onClick={() => setShowHowto((value) => !value)}
          >
            <span>{showHowto ? '▾' : '▸'}</span> How to export from Exchange
          </button>
          {showHowto ? (
            <ol>
              <li>
                Open{' '}
                <a
                  href="https://admin.exchange.microsoft.com/#/messagetrace"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Exchange message trace
                </a>
              </li>
              <li>
                Click <strong>Custom queries</strong>
              </li>
              <li>
                Pick <strong>Last two weeks</strong> or <strong>Last week</strong>
              </li>
              <li>
                Check <strong>Extended report</strong>
              </li>
              <li>
                Click <strong>Next</strong>, then <strong>Save</strong>
              </li>
              <li>Download the CSV and drop it above</li>
            </ol>
          ) : null}
        </div>
      </aside>
    </>
  )
}
