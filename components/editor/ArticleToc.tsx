'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

type TipTapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
}

interface TocEntry {
  idx: number
  level: number
  text: string
  id: string
}

// Anker aus dem Ueberschriftentext. Bewusst lesbar statt einer opaken Id:
// die entstehende URL (/notes/rezept#zutaten) soll man verschicken koennen.
// Preis dafuer ist, dass ein umbenannter Abschnitt alte Links brechen laesst
// -- dieselbe Abwaegung treffen GitHub und MDN.
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getText(node: TipTapNode): string {
  if (node.text) return node.text
  return node.content?.map(getText).join('') ?? ''
}

// Collect headings in document order, including those nested in sections/toggles.
// The page title lives outside this content tree (rendered by NoteHeader), so
// it never reaches here — only headings the author typed in the body do.
function extractHeadings(content: object): TocEntry[] {
  const entries: TocEntry[] = []
  function walk(node: TipTapNode) {
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level) || 1
      const text = getText(node).trim()
      if (text) {
        // Gleichlautende Ueberschriften bekommen einen Zaehler angehaengt,
        // sonst zeigen zwei Anker auf dieselbe Stelle.
        const base = slugifyHeading(text) || `abschnitt-${entries.length + 1}`
        let id = base
        let n = 2
        while (entries.some(entry => entry.id === id)) { id = `${base}-${n}`; n += 1 }
        entries.push({ idx: entries.length, level, text, id })
      }
      return
    }
    node.content?.forEach(walk)
  }
  const doc = content as TipTapNode
  doc.content?.forEach(walk)
  return entries
}

function headingElements(containerSelector: string): HTMLElement[] {
  const container = document.querySelector(containerSelector)
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3'))
    .filter(el => el.textContent?.trim())
}

export default function ArticleToc({
  content,
  containerSelector = '[data-article-editor="true"]',
}: {
  content: object
  containerSelector?: string
}) {
  const entries = useMemo(() => extractHeadings(content), [content])
  const [activeIdx, setActiveIdx] = useState(0)
  // Below 1100px the aside is hidden (CSS); this drives the right-side
  // drawer that stands in for it on mobile/tablet.
  const [mobileOpen, setMobileOpen] = useState(false)
  // entries wird bei jedem Tastendruck neu berechnet, der Anker-Effekt laeuft
  // also staendig. Ohne diese Sperre spraenge der Cursor beim Tippen immer
  // wieder zum Anker aus der Adresszeile zurueck.
  const jumpedToHashRef = useRef(false)

  useEffect(() => {
    if (!entries.length) return

    const mainEl = document.querySelector('main') as HTMLElement | null
    let raf = 0

    function updateActive() {
      cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        // Query fresh on every tick: the editor mounts client-side after this
        // effect runs, so a list captured at setup time would stay empty.
        const headings = headingElements(containerSelector)
        if (!headings.length) return
        // The page (body) scrolls, so the threshold is viewport-relative
        const threshold = 140
        let active = 0

        for (let i = 0; i < headings.length; i++) {
          if (headings[i].getBoundingClientRect().top <= threshold) active = i
        }

        setActiveIdx(active)
      })
    }

    updateActive()
    mainEl?.addEventListener('scroll', updateActive, { passive: true })
    window.addEventListener('scroll', updateActive, { passive: true })
    window.addEventListener('resize', updateActive, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      mainEl?.removeEventListener('scroll', updateActive)
      window.removeEventListener('scroll', updateActive)
      window.removeEventListener('resize', updateActive)
    }
  }, [containerSelector, content, entries.length])

  // Die Ueberschriften rendert TipTap, Ids vergibt es keine. Sie hier zu
  // setzen haelt Anker und TOC an derselben Quelle -- beide leiten sich aus
  // derselben Liste ab und koennen nicht auseinanderlaufen.
  // Der Editor mountet client-seitig, die Elemente existieren also spaeter als
  // dieser Effekt; deshalb wird nachgefasst, bis sie da sind.
  useEffect(() => {
    if (!entries.length) return
    let tries = 0
    let raf = 0

    function apply() {
      const headings = headingElements(containerSelector)
      if (headings.length !== entries.length) {
        // Noch nicht fertig gerendert -- ein paar Frames warten.
        if (tries++ < 60) { raf = window.requestAnimationFrame(apply) }
        return
      }
      headings.forEach((el, i) => { el.id = entries[i].id })

      // Einmalig zum Anker aus der Adresszeile springen.
      if (jumpedToHashRef.current) return
      jumpedToHashRef.current = true
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      if (!hash) return
      const target = entries.findIndex(entry => entry.id === hash)
      if (target >= 0) scrollTo(target)
    }

    apply()
    return () => cancelAnimationFrame(raf)
    // scrollTo liest nur Refs/DOM und ist ueber Renders hinweg gleichwertig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSelector, entries])

  // Escape schliesst, Body-Scroll gesperrt solange offen (wie Sidebar-Drawer)
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [mobileOpen])

  function scrollTo(idx: number, closeMobile = false) {
    const el = headingElements(containerSelector)[idx]
    if (!el) return
    setActiveIdx(idx)
    // replaceState statt pushState: der Zurueck-Knopf soll nicht durch die
    // Abschnitte einer Seite zuruecklaufen, die Adresse aber kopierbar sein.
    const id = entries[idx]?.id
    if (id) {
      try { window.history.replaceState(null, '', `#${id}`) } catch {}
    }
    // Manual offset instead of scroll-margin-top + scrollIntoView: the fixed
    // mobile topbar (56px) isn't part of layout flow, and some mobile
    // browsers overshoot past the target when combining scroll-margin with
    // smooth scrollIntoView. Computing the target ourselves is predictable.
    const headerOffset = window.matchMedia('(max-width: 768px)').matches ? 72 : 20
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top, behavior: 'smooth' })
    if (closeMobile) setMobileOpen(false)
  }

  if (!entries.length) return null

  function renderEntries(closeMobile: boolean) {
    return entries.map(({ idx, level, text }) => {
      const isActive = idx === activeIdx
      return (
        <a
          key={idx}
          href={`#${entries[idx].id}`}
          onClick={e => { e.preventDefault(); scrollTo(idx, closeMobile) }}
          title={text}
          aria-current={isActive ? 'true' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            minHeight: '30px',
            padding: '5px 8px',
            paddingLeft: `${8 + (level - 1) * 14}px`,
            borderRadius: '6px',
            border: 'none',
            textDecoration: 'none',
            background: isActive ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent',
            color: isActive ? 'var(--text)' : 'var(--muted)',
            fontWeight: isActive ? 600 : 500,
            fontFamily: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'background 0.12s, color 0.12s',
            lineHeight: 1.4,
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--muted)' }}
        >
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '999px',
            flexShrink: 0,
            marginLeft: '-1px',
            background: isActive ? 'var(--accent)' : 'var(--border)',
            opacity: isActive ? 1 : 0.7,
            transition: 'background 0.12s, opacity 0.12s',
          }} />
          <span style={{
            display: 'block',
            fontSize: level === 1 ? '13px' : '12px',
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {text}
          </span>
        </a>
      )
    })
  }

  return (
    <>
      <aside className="article-toc" style={{
        width: 'clamp(220px, 19vw, 260px)',
        flexShrink: 0,
        position: 'sticky',
        top: 20,
        alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        padding: '6px 0 6px 18px',
        borderLeft: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '10px',
          paddingLeft: '8px',
        }}>
          Inhalt
        </div>
        <div style={{ display: 'grid', gap: '2px' }}>
          {renderEntries(false)}
        </div>
      </aside>

      {/* Nur auf Mobil/Tablet sichtbar (CSS unter 1100px): schwebender Button
          oeffnet das Inhaltsverzeichnis als Drawer von rechts. */}
      <button
        type="button"
        className="toc-mobile-trigger"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? 'Inhaltsverzeichnis schließen' : 'Inhaltsverzeichnis öffnen'}
        aria-expanded={mobileOpen}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="8" y1="18" x2="20" y2="18" />
          <line x1="4" y1="6" x2="4" y2="6" />
          <line x1="4" y1="12" x2="4" y2="12" />
          <line x1="4" y1="18" x2="4" y2="18" />
        </svg>
      </button>

      <div
        className="toc-drawer-backdrop"
        data-open={mobileOpen || undefined}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className="toc-drawer" data-open={mobileOpen || undefined}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Inhalt
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Schließen"
            style={{
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: '8px', background: 'transparent', color: 'var(--text)', cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'grid', gap: '2px' }}>
          {renderEntries(true)}
        </div>
      </aside>
    </>
  )
}
