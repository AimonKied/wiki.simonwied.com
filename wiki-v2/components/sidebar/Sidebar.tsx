'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/lib/types'

const primaryNav = [
  { label: 'Startseite', href: '/', color: '#009955' },
  { label: 'Oeffentlich', href: '/#oeffentlich', color: '#4488ff' },
  { label: 'Kategorien', href: '/#kategorien', color: '#bb7700' },
]

const creationNav = [
  { label: 'Neuer Artikel', href: '/create?type=article', color: '#009955' },
  { label: 'Neuer Workspace', href: '/create?type=workspace', color: '#4488ff' },
]

const categoryNav = [
  { label: 'Rezepte', href: '/?category=rezepte', color: '#bb7700' },
  { label: 'Security', href: '/?category=security', color: '#ff4466' },
  { label: 'Development', href: '/?category=development', color: '#f05033' },
  { label: 'Ressourcen', href: '/?category=ressourcen', color: '#7c3aed' },
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
  if (!notes.length) return null
  return (
    <div style={{ padding: '0 12px', marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
        Meine Notizen
      </div>
      {notes.map(note => {
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const activeTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    setTheme(activeTheme)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    localStorage.setItem('wiki-theme', nextTheme)
    window.dispatchEvent(new CustomEvent('wiki-theme-change', { detail: { theme: nextTheme } }))
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
          Artikel und Canvas-Workspaces
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <SidebarSection title="Navigation" items={primaryNav} pathname={pathname} />
        {isLoggedIn && (
          <>
            <SidebarSection title="Erstellen" items={creationNav} pathname={pathname} />
            <SidebarSection title="Privat" items={[{ label: 'Dashboard', href: '/dashboard', color: '#009955' }]} pathname={pathname} />
            {notes && notes.length > 0 && (
              <NotesList notes={notes} pathname={pathname} />
            )}
          </>
        )}
        <SidebarSection title="Kategorien" items={categoryNav} pathname={pathname} />
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={toggleTheme}
          title="Darstellung wechseln"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '12px',
            padding: '7px 9px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--surface2)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '12px',
          }}
        >
          <span>{theme === 'dark' ? 'Darkmode' : 'Lightmode'}</span>
          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>{theme === 'dark' ? 'Dunkel' : 'Hell'}</span>
        </button>
        {isLoggedIn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href="/create?type=article" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>
              + Artikel
            </Link>
            <Link href="/create?type=workspace" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>
              + Workspace
            </Link>
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
