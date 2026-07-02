'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/lib/types'

const primaryNav = [
  { label: 'Bibliothek', href: '/', color: '#009955' },
]

const workspaceNav = [
  { label: 'Arbeitsbereich', href: '/dashboard', color: '#4488ff' },
  { label: 'Neuer Inhalt', href: '/create', color: '#009955' },
]

function SidebarSection({
  title,
  items,
  pathname,
}: {
  title: string
  items: Array<{ label: string; href: string; color: string }>
  pathname: string
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
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
            {item.label}
          </Link>
        )
      })}
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
              <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '9px', color: 'var(--accent)', fontWeight: 700 }}>O</span>
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
          Wiki<span style={{ color: 'var(--accent)' }}>.</span>
        </Link>
        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.45 }}>
          Wissen, Notizen und Workspaces
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <SidebarSection title="Navigation" items={primaryNav} pathname={pathname} />
        {isLoggedIn && (
          <>
            <SidebarSection title="Privat" items={workspaceNav} pathname={pathname} />
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
