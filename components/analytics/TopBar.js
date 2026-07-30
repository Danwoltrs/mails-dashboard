import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import s from '../../styles/EmailAnalytics.module.css'
import { fmtDay, fmtInt } from '../../utils/format'

export default function TopBar({
  session,
  totalEmails,
  fileCount,
  lastEmailDate,
  onManageFiles,
  onExport,
  canExport,
  onOpenAdmin,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDocClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const name = session?.user?.name || session?.user?.email || ''
  const shortName = name.split(' ')[0] || name

  return (
    <div className={s.top}>
      <img
        className={s.logo}
        src="https://wolthers.com/images/wolthers-logo-off-white.svg"
        alt="Wolthers & Associates"
      />
      <div className={s.sep} />
      <h1>Email Analytics</h1>
      <div className={s.meta}>
        <span>
          <b>{fmtInt(totalEmails)}</b> emails
        </span>
        <span>
          <b>{fmtInt(fileCount)}</b> files merged
        </span>
        {lastEmailDate ? (
          <span>
            through <b>{fmtDay(lastEmailDate)}</b>
          </span>
        ) : null}
      </div>
      <div className={s.right}>
        <button type="button" className={s.ghost} onClick={onManageFiles}>
          Manage files
        </button>
        <button type="button" className={s.ghost} onClick={onExport} disabled={!canExport}>
          Export
        </button>
        <div className={s.userMenu} ref={menuRef}>
          <button
            type="button"
            className={s.ghost}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {shortName} ▾
          </button>
          {menuOpen ? (
            <div className={s.menuPanel} role="menu">
              <div className={s.menuMail}>{session?.user?.email}</div>
              {session?.user?.isAdmin ? (
                <button
                  type="button"
                  className={s.menuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenAdmin()
                  }}
                >
                  Admin panel
                </button>
              ) : null}
              <button
                type="button"
                className={s.menuItem}
                role="menuitem"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
