'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/lib/types'

type TypeFilter = 'all' | 'article' | 'workspace'

const TYPE_FILTERS: Array<{ key: TypeFilter; label: string }> = [
  { key: 'all', label: 'Alle' },
  { key: 'article', label: 'Artikel' },
  { key: 'workspace', label: 'Workspaces' },
]

function formatDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) {
    return `Heute, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (date.toDateString() === yesterday.toDateString()) return 'Gestern'
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function LockIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-label="Privat" style={{ flexShrink: 0 }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function NoteRow({ note, onDeleteRequest }: { note: Note; onDeleteRequest: (note: Note) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const isArticle = note.content_type === 'article'
  const showActions = hovered || menuOpen

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false) }}
    >
      <Link
        href={`/notes/${note.id}/edit`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 44px 12px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          textDecoration: 'none',
          color: 'var(--text)',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <span style={{ fontSize: '16px', flexShrink: 0, width: '22px', textAlign: 'center' }}>
          {note.emoji ?? (isArticle ? '📄' : '🗂️')}
        </span>
        <span style={{
          fontSize: '14px', fontWeight: 700, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: note.title ? 'var(--text)' : 'var(--muted)',
        }}>
          {note.title || (isArticle ? 'Ohne Titel' : 'Unbenannter Workspace')}
        </span>
        {!note.is_public && <LockIcon />}
        {note.is_public && (
          <span title="Öffentlich" style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
        )}
        {/* Locale/timezone formatting can differ between SSR and browser */}
        <span suppressHydrationWarning style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>
          {formatDate(note.updated_at)}
        </span>
      </Link>

      <button
        type="button"
        aria-label="Optionen"
        onClick={e => { e.preventDefault(); setMenuOpen(o => !o) }}
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '24px',
          height: '24px',
          border: 'none',
          borderRadius: '6px',
          background: menuOpen ? 'var(--surface2)' : 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showActions ? 1 : 0,
          pointerEvents: showActions ? 'auto' : 'none',
          transition: 'opacity 0.12s, background 0.12s',
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <div style={{
          position: 'absolute',
          right: '10px',
          top: 'calc(100% + 4px)',
          zIndex: 40,
          width: '168px',
          padding: '6px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
        }}>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onDeleteRequest(note) }}
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
    </div>
  )
}

export default function NotesOverview({ notes: initialNotes }: { notes: Note[] }) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)

  const filtered = notes.filter(note => {
    if (typeFilter !== 'all' && note.content_type !== typeFilter) return false
    if (query.trim() && !(note.title || '').toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })

  const articles = filtered.filter(n => n.content_type === 'article')
  const workspaces = filtered.filter(n => n.content_type === 'workspace')

  async function deleteNote(note: Note) {
    const supabase = createClient()
    const { error } = await supabase.from('notes').delete().eq('id', note.id)
    if (error) return
    setNotes(current => current.filter(n => n.id !== note.id))
    setPendingDelete(null)
    // Sidebar "Zuletzt" refetches on this
    document.dispatchEvent(new Event('wiki-notes-changed'))
  }

  function renderList(list: Note[]) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {list.map(note => (
          <NoteRow key={note.id} note={note} onDeleteRequest={setPendingDelete} />
        ))}
      </div>
    )
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {TYPE_FILTERS.map(f => {
          const isActive = typeFilter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)'),
                background: isActive ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface)',
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          )
        })}
        <input
          value={query}
          autoFocus
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            // Enter opens the first match — type, hit Enter, you're there
            if (e.key === 'Enter' && filtered[0]) router.push(`/notes/${filtered[0].id}/edit`)
          }}
          placeholder="Suchen… (Enter öffnet ersten Treffer)"
          className="ui-input"
          style={{
            marginLeft: 'auto',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontFamily: 'inherit',
            outline: 'none',
            width: 'min(100%, 220px)',
          }}
        />
      </div>

      {!filtered.length ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '13px',
        }}>
          {notes.length
            ? 'Nichts gefunden.'
            : 'Noch keine Inhalte. Lege oben über „Neuer Inhalt“ deinen ersten Artikel oder Workspace an.'}
        </div>
      ) : typeFilter === 'all' ? (
        // Artikel und Workspaces nebeneinander; auf schmalen Screens untereinander
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px', alignItems: 'start' }}>
          {articles.length > 0 && (
            <div>
              <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Artikel
              </h2>
              {renderList(articles)}
            </div>
          )}
          {workspaces.length > 0 && (
            <div>
              <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Workspaces
              </h2>
              {renderList(workspaces)}
            </div>
          )}
        </div>
      ) : (
        renderList(filtered)
      )}

      {pendingDelete && (
        <div
          onClick={() => setPendingDelete(null)}
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
              {pendingDelete.content_type === 'article' ? 'Artikel löschen?' : 'Workspace löschen?'}
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              „{pendingDelete.title || 'Ohne Titel'}“ wird endgültig gelöscht.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
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
                onClick={() => deleteNote(pendingDelete)}
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
    </section>
  )
}
