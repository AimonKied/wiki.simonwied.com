'use client'

import { useState, useEffect } from 'react'

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
      if (text) entries.push({ idx: entries.length, level, text })
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
  const [entries, setEntries] = useState<TocEntry[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  // Below 1100px the aside is hidden (CSS); this drives the right-side
  // drawer that stands in for it on mobile/tablet.
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setEntries(extractHeadings(content))
  }, [content])

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
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (closeMobile) setMobileOpen(false)
  }

  if (!entries.length) return null

  function renderEntries(closeMobile: boolean) {
    return entries.map(({ idx, level, text }) => {
      const isActive = idx === activeIdx
      return (
        <button
          key={idx}
          type="button"
          onClick={() => scrollTo(idx, closeMobile)}
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
        </button>
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
