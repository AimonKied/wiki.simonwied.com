'use client'

import { useState } from 'react'
import Link from 'next/link'

interface PageDef {
  slug: string
  label: string
  emoji: string
  categorySlug: string
  isPublic: boolean
}

const PAGES: PageDef[] = [
  { slug: 'git-commands',        label: 'Git Commands',           emoji: '🐙', categorySlug: 'informatik', isPublic: true },
  { slug: 'web-hacking',         label: 'Web Hacking',            emoji: '⚔️', categorySlug: 'informatik', isPublic: true },
  { slug: 'cybertools',          label: 'CyberTools',             emoji: '🧰', categorySlug: 'informatik', isPublic: true },
  { slug: 'awesome-list',        label: 'Awesome List',           emoji: '⭐', categorySlug: 'sonstiges',  isPublic: true },
  { slug: 'linsen-mit-spaetzle', label: 'Linsen mit Spätzle',     emoji: '🍲', categorySlug: 'rezepte',    isPublic: true },
  { slug: 'buttermilk-chicken',  label: 'Butter Chicken',         emoji: '🍛', categorySlug: 'rezepte',    isPublic: true },
  { slug: 'croquetas',           label: 'Croquetas',              emoji: '🇪🇸', categorySlug: 'rezepte',    isPublic: true },
]

type Status = 'idle' | 'loading' | 'done' | 'exists' | 'error'

export default function MigratePage() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [results, setResults] = useState<Record<string, string>>({})

  function setStatus(slug: string, status: Status, msg = '') {
    setStatuses(s => ({ ...s, [slug]: status }))
    if (msg) setResults(r => ({ ...r, [slug]: msg }))
  }

  async function migrate(page: PageDef) {
    setStatus(page.slug, 'loading')
    try {
      const res = await fetch('/api/migrate-v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: page.slug,
          categorySlug: page.categorySlug,
          isPublic: page.isPublic,
        }),
      })
      const json = await res.json() as { id?: string; error?: string }
      if (res.status === 409) {
        setStatus(page.slug, 'exists', json.id ?? '')
      } else if (!res.ok) {
        setStatus(page.slug, 'error', json.error ?? 'Unbekannter Fehler')
      } else {
        setStatus(page.slug, 'done', json.id ?? '')
      }
    } catch (e) {
      setStatus(page.slug, 'error', String(e))
    }
  }

  async function migrateAll() {
    for (const page of PAGES) {
      if (statuses[page.slug] === 'done' || statuses[page.slug] === 'exists') continue
      await migrate(page)
    }
  }

  const allDone = PAGES.every(p => statuses[p.slug] === 'done' || statuses[p.slug] === 'exists')

  return (
    <div style={{ maxWidth: 680, animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', margin: '0 0 6px' }}>
          V1 Migration
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          Importiert bestehende wiki v1 Seiten als Artikel in die Datenbank.
          Nur lokal verfügbar.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={migrateAll}
          disabled={allDone}
          style={{
            padding: '9px 20px',
            background: allDone ? 'none' : 'var(--accent)',
            color: allDone ? 'var(--muted)' : '#fff',
            border: allDone ? '1px solid var(--border)' : 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: allDone ? 'default' : 'pointer',
          }}
        >
          {allDone ? 'Alle migriert' : 'Alle migrieren'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PAGES.map(page => {
          const status = statuses[page.slug] ?? 'idle'
          const noteId = results[page.slug]

          return (
            <div
              key={page.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--surface)',
                border: `1px solid ${status === 'error' ? 'var(--accent2)' : status === 'done' ? '#00995544' : 'var(--border)'}`,
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{page.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{page.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {page.slug} · {page.categorySlug}
                  {status === 'error' && (
                    <span style={{ color: 'var(--accent2)', marginLeft: 8 }}>{results[page.slug]}</span>
                  )}
                  {status === 'exists' && (
                    <span style={{ color: 'var(--muted)', marginLeft: 8 }}>Bereits vorhanden</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {(status === 'done' || status === 'exists') && noteId && (
                  <Link
                    href={`/notes/${noteId}/edit`}
                    style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    Öffnen →
                  </Link>
                )}
                <StatusBadge status={status} />
                {status !== 'done' && status !== 'exists' && (
                  <button
                    onClick={() => migrate(page)}
                    disabled={status === 'loading'}
                    style={{
                      padding: '6px 14px',
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                      opacity: status === 'loading' ? 0.6 : 1,
                    }}
                  >
                    {status === 'loading' ? '…' : 'Migrieren'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; color: string }> = {
    idle:    { label: 'Ausstehend', color: 'var(--muted)' },
    loading: { label: 'Lädt…',     color: '#4488ff' },
    done:    { label: '✓ Fertig',   color: '#00aa55' },
    exists:  { label: '= Vorhanden', color: 'var(--muted)' },
    error:   { label: '✗ Fehler',  color: 'var(--accent2)' },
  }
  const { label, color } = map[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 70, textAlign: 'right' }}>
      {label}
    </span>
  )
}
