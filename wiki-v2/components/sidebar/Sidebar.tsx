'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/lib/types'

const primaryNav = [
  { label: 'Bibliothek', href: '/' },
]

const workspaceNav = [
  { label: 'Arbeitsbereich', href: '/dashboard' },
]

const newContentOptions = [
  { label: 'Artikel', href: '/create?type=article' },
  { label: 'Canvas Workspace', href: '/create?type=workspace' },
]

function NewContentNavItem() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const flyRef = useRef<HTMLDivElement>(null)

  function toggle() {
    setOpen(o => {
      const next = !o
      if (next && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect()
        // subtract flyout padding (6) + link/button padding diff (1) so the first
        // option lines up with the "Neuer Inhalt" row
        setCoords({ top: r.top - 7, left: r.right + 6 })
      }
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (flyRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '7px 8px',
          borderRadius: '6px',
          fontSize: '13px',
          color: open ? 'var(--text)' : 'var(--muted)',
          background: open ? 'var(--surface2)' : 'transparent',
          border: 'none',
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s',
        }}
      >
        <span>Neuer Inhalt</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '9px',
            lineHeight: 1,
            transform: open ? 'rotate(-90deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          ▸
        </span>
      </button>
      {open && coords && (
        <div
          ref={flyRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 100,
            width: '200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '6px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            animation: 'fadeIn 0.12s ease both',
          }}
        >
          {newContentOptions.map(opt => {
            const isSelected = selected === opt.href
            return (
              <Link
                key={opt.href}
                href={opt.href}
                onClick={() => { setSelected(opt.href); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: isSelected ? 'var(--text)' : 'var(--muted)',
                  background: isSelected ? 'var(--surface2)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {opt.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SidebarSection({
  title,
  items,
  pathname,
  children,
}: {
  title: string
  items: Array<{ label: string; href: string }>
  pathname: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ padding: '0 12px', marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
        {title}
      </div>
      {items.map(item => {
        const itemPath = item.href.split('?')[0].split('#')[0] || '/'
        const isFilteredLink = item.href.includes('?') || item.href.includes('#')
        const isActive = !isFilteredLink && (itemPath === '/' ? pathname === '/' : pathname.startsWith(itemPath))
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 8px',
              borderRadius: '6px',
              fontSize: '13px',
              color: isActive ? 'var(--text)' : 'var(--muted)',
              background: isActive ? 'var(--surface2)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
          >
            {item.label}
          </Link>
        )
      })}
      {children}
    </div>
  )
}

function NotesList({ notes, pathname }: { notes: Note[]; pathname: string }) {
  const visibleNotes = notes.slice(0, 8)
  if (!visibleNotes.length) return null
  return (
    <div style={{ padding: '0 12px', marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
        Zuletzt
      </div>
      {visibleNotes.map(note => {
        const href = `/notes/${note.id}/edit`
        const isActive = pathname === href
        return (
          <Link
            key={note.id}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              color: isActive ? 'var(--text)' : 'var(--muted)',
              background: isActive ? 'var(--surface2)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              overflow: 'hidden',
            }}
          >
            <span style={{ flexShrink: 0, fontSize: '13px' }}>{note.emoji ?? (note.content_type === 'article' ? '📄' : '🗂️')}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {note.title}
            </span>
            {note.is_public && (
              <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '9px', color: 'var(--muted)', fontWeight: 700 }}>O</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export default function Sidebar({ isLoggedIn, notes }: { isLoggedIn: boolean; notes?: Note[] }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <nav style={{
      width: '260px',
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '28px 0',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1,
    }}>
      <div style={{ padding: '0 20px 16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text)', fontSize: '22px', fontWeight: 800 }}>
          Wiki
        </Link>
        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.45 }}>
          Wissen, Notizen und Workspaces
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <SidebarSection title="Navigation" items={primaryNav} pathname={pathname} />
        {isLoggedIn && (
          <>
            <SidebarSection title="Privat" items={workspaceNav} pathname={pathname}>
              <NewContentNavItem />
            </SidebarSection>
            {notes && notes.length > 0 && (
              <NotesList notes={notes} pathname={pathname} />
            )}
          </>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        {isLoggedIn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={handleLogout} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              Abmelden
            </button>
          </div>
        ) : (
          <Link href="/login" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
            Anmelden
          </Link>
        )}
        <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          wiki.simonwied.com
        </div>
      </div>
    </nav>
  )
}
