'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createNote } from '@/lib/notes/create'
import type { NoteSummary } from '@/lib/notes/types'
import Logo from '@/components/Logo'
import QuickSearch from '@/components/search/QuickSearch'

const primaryNav = [
  { label: 'Bibliothek', href: '/bibliothek' },
]

const privateNav = [
  { label: 'Arbeitsbereich', href: '/dashboard' },
  { label: 'Papierkorb', href: '/papierkorb' },
]

// Ein Klick legt den Artikel an und springt in den Editor — seit dem Wegfall
// des Canvas gibt es nur noch einen Inhaltstyp, also auch kein Flyout mehr.
function NewContentNavItem() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function create() {
    setCreateError('')
    setCreating(true)
    try {
      const id = await createNote()
      router.push(`/notes/${id}/edit`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Artikel konnte nicht erstellt werden.')
      setCreating(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={create}
        disabled={creating}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '7px 8px',
          borderRadius: '6px',
          fontSize: '13px',
          color: 'var(--muted)',
          background: 'transparent',
          border: 'none',
          fontFamily: 'inherit',
          cursor: creating ? 'wait' : 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <span>{creating ? 'Wird erstellt…' : 'Neuer Artikel'}</span>
        <span style={{ marginLeft: 'auto', fontSize: '13px', lineHeight: 1 }}>+</span>
      </button>
      {createError && (
        <p role="alert" style={{ margin: '4px 8px', color: 'var(--accent2)', fontSize: '11px', lineHeight: 1.4 }}>
          {createError}
        </p>
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

// "Zuletzt" = Notizen mit last_opened_at, account-weit aus der DB. Die
// Edit-Seite stempelt beim Oeffnen; nie geoeffnete Notizen erscheinen nicht.
function NotesList({ notes, pathname }: { notes: NoteSummary[]; pathname: string }) {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)
  const reloadNotesRef = useRef<null | (() => Promise<void>)>(null)
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [pendingDeleteNote, setPendingDeleteNote] = useState<NoteSummary | null>(null)
  const [notesError, setNotesError] = useState('')
  // Startwert kommt server-seitig, bereits nach last_opened_at sortiert
  const [recentNotes, setRecentNotes] = useState<NoteSummary[]>(notes)

  // Beim Navigieren neu laden; der last_opened_at-Stempel der Edit-Seite
  // sortiert die geoeffnete Notiz nach vorn.
  useEffect(() => {
    void reloadNotesRef.current?.()
  }, [pathname])

  useEffect(() => {
    if (!openMenuId) return
    function onDocClick(e: MouseEvent) {
      if (listRef.current?.contains(e.target as Node)) return
      setOpenMenuId(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenuId])

  useEffect(() => {
    if (!pendingDeleteNote) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPendingDeleteNote(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pendingDeleteNote])

  useEffect(() => {
    let cancelled = false
    let supabaseClient: ReturnType<typeof createClient> | null = null
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    async function setupLiveNotes() {
      const supabase = createClient()
      supabaseClient = supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user || cancelled) return

      const loadRecentNotes = async () => {
        const { data, error } = await supabase
          .from('notes')
          .select('id, title, emoji, visibility, is_public, slug, updated_at, is_favorite')
          .eq('user_id', user.id)
          .not('last_opened_at', 'is', null)
          .order('last_opened_at', { ascending: false })
          .limit(8)

        if (error) {
          if (!cancelled) setNotesError(`Zuletzt-Liste konnte nicht geladen werden: ${error.message}`)
          return
        }
        if (!cancelled && data) {
          setNotesError('')
          setRecentNotes(data as NoteSummary[])
        }
      }

      reloadNotesRef.current = loadRecentNotes
      await loadRecentNotes()

      channel = supabase
        .channel(`sidebar-notes-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          void loadRecentNotes()
        })
        .subscribe()
    }

    void setupLiveNotes().catch((error: unknown) => {
      if (!cancelled) {
        setNotesError(error instanceof Error ? error.message : 'Zuletzt-Liste konnte nicht geladen werden.')
      }
    })

    return () => {
      cancelled = true
      reloadNotesRef.current = null
      if (channel && supabaseClient) void supabaseClient.removeChannel(channel)
    }
  }, [])

  // Fallbacks that don't need Supabase realtime: saves in this tab dispatch
  // 'wiki-notes-changed', plus refetch on window focus and on navigation.
  useEffect(() => {
    const reload = () => { void reloadNotesRef.current?.() }
    document.addEventListener('wiki-notes-changed', reload)
    window.addEventListener('focus', reload)
    return () => {
      document.removeEventListener('wiki-notes-changed', reload)
      window.removeEventListener('focus', reload)
    }
  }, [])

  // Notion-style live title: the edit page broadcasts every keystroke on
  // title/emoji; patch the local list directly — no DB round trip involved.
  useEffect(() => {
    function onPatch(e: Event) {
      const detail = (e as CustomEvent<{ id?: string; title?: string; emoji?: string | null }>).detail
      if (!detail?.id) return
      setRecentNotes(current => current.map(n =>
        n.id === detail.id
          ? {
              ...n,
              ...(detail.title !== undefined ? { title: detail.title } : {}),
              ...(detail.emoji !== undefined ? { emoji: detail.emoji } : {}),
            }
          : n
      ))
    }
    document.addEventListener('wiki-note-patched', onPatch)
    return () => document.removeEventListener('wiki-note-patched', onPatch)
  }, [])

  async function deleteNote(noteId: string) {
    setNotesError('')
    const supabase = createClient()
    const { error } = await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', noteId)
    if (error) {
      setNotesError(`Löschen fehlgeschlagen: ${error.message}`)
      return
    }
    await reloadNotesRef.current?.()
    setOpenMenuId(null)
    setPendingDeleteNote(null)
    setHoveredNoteId(null)
    if (pathname === `/notes/${noteId}/edit`) {
      router.push('/dashboard')
      return
    }
  }

  async function unpublishNote(noteId: string) {
    setNotesError('')
    const supabase = createClient()
    const { error } = await supabase.rpc('set_note_private', { p_note_id: noteId })
    if (error) {
      setNotesError(`Privatstellen fehlgeschlagen: ${error.message}`)
      return
    }
    await reloadNotesRef.current?.()
    setOpenMenuId(null)
    setHoveredNoteId(null)
    document.dispatchEvent(new Event('wiki-notes-changed'))
  }

  // Verlaufsreihenfolge kommt aus recentIds: die aktive Notiz wurde beim
  // Oeffnen bereits nach vorn gebumpt.
  const visibleNotes = recentNotes
  if (!visibleNotes.length && !notesError) return null
  return (
    <div ref={listRef} style={{ padding: '0 12px', marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
        Zuletzt
      </div>
      {notesError && (
        <p role="alert" style={{ padding: '4px 8px', color: 'var(--accent2)', fontSize: '11px', lineHeight: 1.4 }}>
          {notesError}
        </p>
      )}
      {visibleNotes.map(note => {
        const href = `/notes/${note.id}/edit`
        const isActive = pathname === href
        const showMenu = openMenuId === note.id
        const showActions = hoveredNoteId === note.id || showMenu
        return (
          <div
            key={note.id}
            onMouseEnter={() => setHoveredNoteId(note.id)}
            onMouseLeave={() => { if (openMenuId !== note.id) setHoveredNoteId(null) }}
            style={{ position: 'relative' }}
          >
            <Link
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 28px 6px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                color: isActive ? 'var(--text)' : 'var(--muted)',
                background: isActive ? 'var(--surface2)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
                overflow: 'hidden',
              }}
            >
              <span style={{ flexShrink: 0, fontSize: '13px' }}>{note.emoji ?? '📄'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.title || 'Neuer Artikel'}
              </span>
              {(note.visibility ?? (note.is_public ? 'public' : 'private')) === 'private' && (
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-label="Privat" style={{ marginLeft: 'auto', flexShrink: 0 }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {(note.visibility ?? (note.is_public ? 'public' : 'private')) === 'link' && (
                <span title="Nur per Link" style={{ marginLeft: 'auto', color: '#d97706', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>
                  LINK
                </span>
              )}
            </Link>

            <button
              type="button"
              aria-label="Notizoptionen"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                setOpenMenuId(current => current === note.id ? null : note.id)
                setHoveredNoteId(note.id)
              }}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                border: 'none',
                borderRadius: '6px',
                background: showActions ? 'var(--surface2)' : 'transparent',
                color: showActions ? 'var(--text)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: showActions ? 1 : 0,
                pointerEvents: showActions ? 'auto' : 'none',
                transition: 'opacity 0.12s, background 0.12s, color 0.12s',
              }}
            >
              ⋯
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute',
                right: '6px',
                top: 'calc(100% + 4px)',
                zIndex: 40,
                width: '168px',
                padding: '6px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
              }}>
                {(note.visibility ?? (note.is_public ? 'public' : 'private')) !== 'private' && (
                  <button
                    type="button"
                    title="Notiz wieder privat schalten"
                    onClick={() => unpublishNote(note.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'transparent',
                      color: 'var(--muted)',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    Privat schalten
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null)
                    setPendingDeleteNote(note)
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: 'var(--accent2)',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  Löschen
                </button>
              </div>
            )}

            {pendingDeleteNote?.id === note.id && (
              <div
                onClick={() => setPendingDeleteNote(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 220,
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(3px)',
                  WebkitBackdropFilter: 'blur(3px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '18px',
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: '360px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '18px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>
                    Artikel löschen?
                  </div>
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                    „{note.title || 'Unbenannter Artikel'}“ wandert in den Papierkorb.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteNote(null)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--accent2)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: 700,
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function subscribeToHydration() {
  return () => {}
}

export default function Sidebar({ isLoggedIn, notes }: { isLoggedIn: boolean; notes?: NoteSummary[] }) {
  const realPathname = usePathname()
  const router = useRouter()
  // Only mark the active link after mount so SSR and first client render agree
  // (usePathname can differ between server and hydration → hydration mismatch).
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const pathname = mounted ? realPathname : ''

  // Mobile: Sidebar ist ein Off-Canvas-Drawer (CSS in globals.css, .sidebar-nav)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Desktop/Tablet: Sidebar laesst sich einklappen (umgekehrter Default zu
  // Mobil — dort startet sie zu, hier startet sie offen). Zustand lebt als
  // Attribut auf <body>, damit .app-main im selben Tick mitreagieren kann.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let stored = false
      try { stored = localStorage.getItem('wiki-sidebar-collapsed') === '1' } catch {}
      setCollapsed(stored)
      document.body.setAttribute('data-sidebar-collapsed', String(stored))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('wiki-sidebar-collapsed', next ? '1' : '0') } catch {}
      document.body.setAttribute('data-sidebar-collapsed', String(next))
      return next
    })
  }

  // Klick auf einen Link im Drawer schliesst ihn (Event-Delegation statt
  // Pathname-Effect: kein setState im Render/Effect, DevTools-freundlich)
  function onNavClick(e: React.MouseEvent) {
    const target = e.target
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
    if (element?.closest('a')) setDrawerOpen(false)
  }

  // Escape schliesst, Body-Scroll gesperrt solange offen
  useEffect(() => {
    if (!drawerOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [drawerOpen])

  async function handleLogout() {
    setDrawerOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <>
    {/* Beide Layouts rendern die Sidebar, die Suche gilt damit ueberall */}
    <QuickSearch isOwner={isLoggedIn} />

    {/* Nur auf Mobil sichtbar (CSS): Topbar mit Hamburger + Logo */}
    <div className="mobile-topbar">
      <button
        type="button"
        onClick={() => setDrawerOpen(o => !o)}
        aria-label={drawerOpen ? 'Navigation schließen' : 'Navigation öffnen'}
        aria-expanded={drawerOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          background: 'none',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>
      <Link href="/" style={{ display: 'inline-flex', textDecoration: 'none', color: 'var(--text)' }} aria-label="Startseite">
        <Logo height={22} />
      </Link>
    </div>

    {/* Nur auf Mobil sichtbar (CSS): Backdrop hinter dem offenen Drawer */}
    <div
      className="sidebar-backdrop"
      data-open={drawerOpen || undefined}
      onClick={() => setDrawerOpen(false)}
      aria-hidden="true"
    />

    {/* Nur auf Desktop/Tablet sichtbar, wenn eingeklappt (CSS): Sidebar wieder oeffnen */}
    <button
      type="button"
      className="sidebar-expand"
      onClick={toggleCollapsed}
      aria-label="Navigation öffnen"
      title="Navigation öffnen"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    </button>

    <nav className="sidebar-nav" data-open={drawerOpen || undefined} data-collapsed={collapsed || undefined} onClick={onNavClick}>
      <div style={{ padding: '0 20px 16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <Link href="/" style={{ display: 'inline-block', textDecoration: 'none', color: 'var(--text)' }} aria-label="Startseite">
            <Logo height={28} />
          </Link>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Navigation schließen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          {/* Nur auf Desktop/Tablet sichtbar (CSS): Sidebar einklappen */}
          <button
            type="button"
            className="sidebar-collapse"
            onClick={toggleCollapsed}
            aria-label="Navigation einklappen"
            title="Navigation einklappen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.45 }}>
          Wissen, Notizen und Artikel
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {!isLoggedIn && (
          <div style={{ padding: '0 20px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link
              href="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--accent)',
                border: '1px solid var(--accent)',
                textDecoration: 'none',
              }}
            >
              Anmelden
            </Link>
          </div>
        )}
        <div style={{ padding: '0 12px', marginBottom: '4px' }}>
          <button
            type="button"
            onClick={() => document.dispatchEvent(new Event('wiki-open-search'))}
            title="Suchen (Strg/Cmd+P)"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '7px 8px', borderRadius: '6px',
              border: 'none', background: 'transparent', color: 'var(--muted)',
              fontFamily: 'inherit', fontSize: '13px', textAlign: 'left',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
            <span>Suchen</span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.7 }}>⌘P</span>
          </button>
        </div>
        <SidebarSection title="Navigation" items={primaryNav} pathname={pathname} />
        {isLoggedIn && (
          <>
            <SidebarSection title="Privat" items={privateNav} pathname={pathname}>
              <NewContentNavItem />
            </SidebarSection>
            {/* Auch mit leerem Startwert mounten: die Liste fuellt sich
                client-seitig, sobald die erste Notiz geoeffnet wird */}
            {notes && <NotesList notes={notes} pathname={pathname} />}
          </>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        {isLoggedIn && (
          <button onClick={handleLogout} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
            Abmelden
          </button>
        )}
        <div style={{ marginTop: isLoggedIn ? '12px' : 0, fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          wiki.simonwied.com
        </div>
      </div>
    </nav>
    </>
  )
}
