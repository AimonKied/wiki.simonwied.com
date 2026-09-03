'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Hit {
  key: string
  href: string
  title: string
  emoji: string | null
  hint: string
}

// Eigene Notizen fuehren in den Editor, oeffentliche in die Leseansicht.
// Fuer Besucher gibt es nur den zweiten Fall -- die RLS auf notes laesst sie
// ohnehin nichts sehen, die RPC liefert genau den veroeffentlichten Bestand.
async function search(query: string, isOwner: boolean): Promise<Hit[]> {
  const supabase = createClient()
  const q = query.trim()
  if (!q) return []

  if (isOwner) {
    const { data } = await supabase
      .from('notes')
      .select('id, title, emoji, slug, visibility, is_public')
      .ilike('title', `%${q}%`)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(12)
    return (data ?? []).map((row: Record<string, unknown>) => {
      const visibility = (row.visibility as string | null) ?? (row.is_public ? 'public' : 'private')
      return {
        key: row.id as string,
        href: `/notes/${row.id as string}/edit`,
        title: (row.title as string) || 'Ohne Titel',
        emoji: (row.emoji as string | null) ?? null,
        hint: visibility === 'public' ? 'Öffentlich' : visibility === 'link' ? 'Nur per Link' : 'Entwurf',
      }
    })
  }

  const { data } = await supabase.rpc('list_public_notes')
  const needle = q.toLowerCase()
  return (data ?? [])
    .map((row: Record<string, unknown>) => {
      const published = (row.published ?? {}) as { title?: string; emoji?: string | null; slug?: string | null }
      return {
        key: row.note_id as string,
        href: published.slug ? `/notes/${published.slug}` : '',
        title: published.title ?? 'Ohne Titel',
        emoji: published.emoji ?? null,
        hint: 'Öffentlich',
      }
    })
    .filter((hit: Hit) => hit.href !== '' && hit.title.toLowerCase().includes(needle))
    .slice(0, 12)
}

export default function QuickSearch({ isOwner }: { isOwner: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [selected, setSelected] = useState(0)
  const [busy, setBusy] = useState(false)
  const hitsRef = useRef<Hit[]>([])
  const selectedRef = useRef(0)

  useEffect(() => { hitsRef.current = hits }, [hits])
  useEffect(() => { selectedRef.current = selected }, [selected])

  // Schliessen raeumt gleich mit auf. Als Effekt auf `open` waere das ein
  // synchroner setState im Effekt-Rumpf -- hier ist es ein Ereignis-Handler.
  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setHits([])
    setSelected(0)
  }, [])

  const go = useCallback((hit: Hit | undefined) => {
    if (!hit) return
    close()
    router.push(hit.href)
  }, [close, router])

  // Strg/Cmd+P wie in Notion. Das ueberschreibt das Drucken-Kuerzel des
  // Browsers -- Strg/Cmd+K ist hier bereits fuer Links vergeben.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        if (open) close()
        else setOpen(true)
        return
      }
      if (!open) return
      if (e.key === 'Escape') { e.preventDefault(); close(); return }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const total = hitsRef.current.length
        if (!total) return
        setSelected(current => (current + (e.key === 'ArrowDown' ? 1 : -1) + total) % total)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        go(hitsRef.current[selectedRef.current])
      }
    }
    document.addEventListener('keydown', onKey, true)
    // Der Sidebar-Eintrag oeffnet ueber dieses Ereignis, damit der Zustand
    // hier bleibt und nicht durch die Sidebar gereicht werden muss.
    const openFromNav = () => setOpen(true)
    document.addEventListener('wiki-open-search', openFromNav)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('wiki-open-search', openFromNav)
    }
  }, [open, close, go])

  // Entprellt: sonst loest jeder Tastendruck eine Abfrage aus. Saemtliche
  // Zustandswechsel liegen im Timer, nicht im Rumpf des Effekts.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) return
    let cancelled = false
    const id = window.setTimeout(() => {
      setBusy(true)
      void search(q, isOwner)
        .then(result => { if (!cancelled) { setHits(result); setSelected(0) } })
        .catch(() => { if (!cancelled) setHits([]) })
        // Bewusst ohne cancelled-Pruefung: wird die Eingabe geleert, waehrend
        // eine Abfrage laeuft, bliebe der Ladehinweis sonst fuer immer stehen.
        .finally(() => setBusy(false))
    }, 180)
    return () => { cancelled = true; window.clearTimeout(id) }
  }, [query, open, isOwner])

  if (!open) return null

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '12vh 18px 18px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '14px', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={isOwner ? 'Notizen durchsuchen…' : 'Öffentliche Artikel durchsuchen…'}
          style={{
            width: '100%', padding: '16px 18px',
            border: 'none', borderBottom: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text)',
            fontFamily: 'inherit', fontSize: '15px', outline: 'none',
          }}
        />
        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '6px' }}>
          {!query.trim() && (
            <p style={{ margin: 0, padding: '14px 12px', fontSize: '12px', color: 'var(--muted)' }}>
              Tippen zum Suchen · ↑↓ wählen · Enter öffnet · Esc schließt
            </p>
          )}
          {query.trim() && busy && (
            <p style={{ margin: 0, padding: '14px 12px', fontSize: '12px', color: 'var(--muted)' }}>Wird gesucht…</p>
          )}
          {query.trim() && !busy && hits.length === 0 && (
            <p style={{ margin: 0, padding: '14px 12px', fontSize: '12px', color: 'var(--muted)' }}>Nichts gefunden.</p>
          )}
          {/* An die Eingabe gebunden: nach dem Leeren des Feldes sollen die
              Treffer der vorigen Suche nicht stehenbleiben. */}
          {query.trim() && hits.map((hit, index) => (
            <button
              key={hit.key}
              type="button"
              onMouseEnter={() => setSelected(index)}
              onClick={() => go(hit)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none', borderRadius: '8px',
                background: index === selected ? 'var(--surface2)' : 'transparent',
                color: 'var(--text)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '13px',
              }}
            >
              <span style={{ width: '20px', flexShrink: 0, textAlign: 'center' }}>{hit.emoji ?? '📄'}</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hit.title}
              </span>
              <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '10px', color: 'var(--muted)' }}>
                {hit.hint}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
