'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createNote } from '@/lib/createNote'
import type { Note } from '@/lib/types'
import Logo from '@/components/Logo'

const primaryNav = [
  { label: 'Bibliothek', href: '/' },
]

const workspaceNav = [
  { label: 'Arbeitsbereich', href: '/dashboard' },
]

const newContentOptions: Array<{ label: string; type: 'article' | 'workspace' }> = [
  { label: 'Artikel', type: 'article' },
  { label: 'Canvas Workspace', type: 'workspace' },
]

const NEW_CONTENT_FLYOUT_WIDTH = 200

function NewContentNavItem() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const flyRef = useRef<HTMLDivElement>(null)

  const getFlyoutCoords = useCallback(() => {
    if (!btnRef.current) return null
    const r = btnRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const margin = 12
    const width = Math.min(NEW_CONTENT_FLYOUT_WIDTH, viewportWidth - margin * 2)
    const isMobile = viewportWidth <= 768

    if (isMobile) {
      return {
        top: r.bottom + 4,
        left: Math.max(margin, Math.min(r.left, viewportWidth - width - margin)),
        width,
      }
    }

    // subtract flyout padding (6) + link/button padding diff (1) so the first
    // option lines up with the "Neuer Inhalt" row
    return {
      top: r.top - 7,
      left: Math.max(margin, Math.min(r.right + 6, viewportWidth - width - margin)),
      width,
    }
  }, [])

  function toggle() {
    setOpen(o => {
      const next = !o
      if (next) setCoords(getFlyoutCoords())
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
    function updatePosition() {
      setCoords(getFlyoutCoords())
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [getFlyoutCoords, open])

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
            width: `${coords.width}px`,
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
            const isCreating = creating === opt.type
            return (
              <button
                key={opt.type}
                type="button"
                disabled={creating !== null}
                onClick={async () => {
                  setCreating(opt.type)
                  const id = await createNote(opt.type)
                  setCreating(null)
                  setOpen(false)
                  if (id) router.push(`/notes/${id}/edit`)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  color: isCreating ? 'var(--text)' : 'var(--muted)',
                  background: isCreating ? 'var(--surface2)' : 'transparent',
                  cursor: creating ? 'wait' : 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!isCreating) e.currentTarget.style.background = 'transparent' }}
              >
                {isCreating ? 'Wird erstellt…' : opt.label}
              </button>
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

// "Zuletzt" = Notizen mit last_opened_at, account-weit aus der DB. Die
// Edit-Seite stempelt beim Oeffnen; nie geoeffnete Notizen erscheinen nicht.
function NotesList({ notes, pathname }: { notes: Note[]; pathname: string }) {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)
  const reloadNotesRef = useRef<null | (() => Promise<void>)>(null)
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [pendingDeleteNote, setPendingDeleteNote] = useState<Note | null>(null)
  // Startwert kommt server-seitig, bereits nach last_opened_at sortiert
  const [recentNotes, setRecentNotes] = useState<Note[]>(notes)

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const loadRecentNotes = async () => {
        const { data } = await supabase
          .from('notes')
          .select('id, title, emoji, content_type, is_public, slug, updated_at')
          .eq('user_id', user.id)
          .not('last_opened_at', 'is', null)
          .order('last_opened_at', { ascending: false })
          .limit(8)

        if (!cancelled && data) {
          setRecentNotes(data as Note[])
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

    void setupLiveNotes()

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
    const supabase = createClient()
    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) return
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
    const supabase = createClient()
    const { error } = await supabase.from('notes').update({ is_public: false }).eq('id', noteId)
    if (error) return
    await reloadNotesRef.current?.()
    setOpenMenuId(null)
    setHoveredNoteId(null)
    document.dispatchEvent(new Event('wiki-notes-changed'))
  }

  // Verlaufsreihenfolge kommt aus recentIds: die aktive Notiz wurde beim
  // Oeffnen bereits nach vorn gebumpt.
  const visibleNotes = recentNotes
  if (!visibleNotes.length) return null
  return (
    <div ref={listRef} style={{ padding: '0 12px', marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
        Zuletzt
      </div>
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
              <span style={{ flexShrink: 0, fontSize: '13px' }}>{note.emoji ?? (note.content_type === 'article' ? '📄' : '🗂️')}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.title || (note.content_type === 'article' ? 'Neuer Artikel' : 'Neuer Workspace')}
              </span>
              {!note.is_public && (
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-label="Privat" style={{ marginLeft: 'auto', flexShrink: 0 }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
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
                {note.is_public && (
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
                    „{note.title || 'Unbenannter Artikel'}“ wird endgültig gelöscht.
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

export default function Sidebar({ isLoggedIn, notes }: { isLoggedIn: boolean; notes?: Note[] }) {
  const realPathname = usePathname()
  const router = useRouter()
  // Only mark the active link after mount so SSR and first client render agree
  // (usePathname can differ between server and hydration → hydration mismatch).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const pathname = mounted ? realPathname : ''

  // Mobile: Sidebar ist ein Off-Canvas-Drawer (CSS in globals.css, .sidebar-nav)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Klick auf einen Link im Drawer schliesst ihn (Event-Delegation statt
  // Pathname-Effect: kein setState im Render/Effect, DevTools-freundlich)
  function onNavClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('a')) setDrawerOpen(false)
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

    <nav className="sidebar-nav" data-open={drawerOpen || undefined} onClick={onNavClick}>
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
        </div>
        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.45 }}>
          Wissen, Notizen und Workspaces
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
            <Link
              href="/register"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'transparent',
                border: '1px solid var(--accent)',
                textDecoration: 'none',
              }}
            >
              Registrieren
            </Link>
          </div>
        )}
        <SidebarSection title="Navigation" items={primaryNav} pathname={pathname} />
        {isLoggedIn && (
          <>
            <SidebarSection title="Privat" items={workspaceNav} pathname={pathname}>
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
