'use client'

import { useState, useEffect } from 'react'
import { useDraggablePanel } from './useDraggablePanel'

type TipTapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
}

interface Section {
  idx: number
  autoTitle: string
}

function getText(node: TipTapNode): string {
  if (node.text) return node.text
  return node.content?.map(getText).join('') ?? ''
}

function extractSections(content: object): Section[] {
  const doc = content as { type?: string; content?: TipTapNode[] }
  if (!doc.content) return []
  return doc.content
    .filter(n => n.type === 'section')
    .map((section, idx) => {
      const heading = section.content?.find(n => n.type === 'heading')
      const para = section.content?.find(n => n.type === 'paragraph')
      const node = heading ?? para
      const title = node ? getText(node).trim() : ''
      return { idx, autoTitle: title || `Block ${idx + 1}` }
    })
}

export default function RightSidebar({ content }: { content: object }) {
  const [sections, setSections] = useState<Section[]>([])
  const [customNames, setCustomNames] = useState<Record<number, string>>({})
  const [activeIdx, setActiveIdx] = useState(0)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  // Unter 1100px ist das schwebende Panel ausgeblendet (CSS); stattdessen
  // oeffnet ein schwebender Button den Drawer von rechts (wie ArticleToc).
  const [mobileOpen, setMobileOpen] = useState(false)
  // Desktop-Panel einklappbar (Zustand persistiert), damit es dem Canvas
  // nicht dauerhaft im Weg liegt — eingeklappt bleibt nur ein runder Button.
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem('wiki-canvas-outline-collapsed') === '1') setDesktopCollapsed(true)
    } catch {}
  }, [])
  function toggleDesktopCollapsed() {
    setDesktopCollapsed(c => {
      const next = !c
      try { localStorage.setItem('wiki-canvas-outline-collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  // Desktop-Panel ist frei verschiebbar (Griff = Kopfzeile), Default-Ort
  // (rechts neben der Werkzeugleiste) kommt aus globals.css.
  const { panelRef, position, onHandlePointerDown } = useDraggablePanel('wiki-canvas-outline-position')
  const positionStyle = position
    ? { left: position.left, top: position.top, right: 'auto' as const }
    : undefined

  useEffect(() => {
    setSections(extractSections(content))
  }, [content])

  // Aktiv-Tracking wie beim Artikel-TOC, nur ist die "Leseposition" hier der
  // Canvas-Viewport statt des Seiten-Scrolls: aktiv ist der Block, dessen
  // Mitte der Workspace-Mitte am naechsten liegt. Der Editor meldet jede
  // Viewport-Aenderung (Pan/Zoom) per wiki-editor-viewport-change.
  useEffect(() => {
    let raf = 0

    function updateActive() {
      cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const workspace = document.querySelector('[data-editor-workspace]')
        const cards = Array.from(document.querySelectorAll('[data-section-card]'))
        if (!workspace || !cards.length) return
        const wsRect = workspace.getBoundingClientRect()
        const centerX = wsRect.left + wsRect.width / 2
        const centerY = wsRect.top + wsRect.height / 2
        let active = 0
        let bestDist = Infinity
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect()
          const dist = Math.hypot(r.left + r.width / 2 - centerX, r.top + r.height / 2 - centerY)
          if (dist < bestDist) { bestDist = dist; active = i }
        }
        setActiveIdx(active)
      })
    }

    updateActive()
    document.addEventListener('wiki-editor-viewport-change', updateActive)
    window.addEventListener('resize', updateActive, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('wiki-editor-viewport-change', updateActive)
      window.removeEventListener('resize', updateActive)
    }
  }, [])

  // Escape schliesst, Body-Scroll gesperrt solange offen (wie ArticleToc-Drawer)
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
    setActiveIdx(idx)
    // The editor pans its canvas viewport so the section lands centered in the workspace
    document.dispatchEvent(new CustomEvent('wiki-editor-focus-section', { detail: { idx } }))
    if (closeMobile) setMobileOpen(false)
  }

  if (!sections.length) return null

  function renderSections(closeMobile: boolean) {
    return sections.map(({ idx, autoTitle }) => {
      const isActive = idx === activeIdx
      const isEditing = idx === editingIdx
      const displayName = customNames[idx] ?? autoTitle

      return (
        <div key={idx} style={{ marginBottom: '2px' }}>
          {isEditing ? (
            <input
              autoFocus
              defaultValue={displayName}
              onBlur={e => {
                const val = e.target.value.trim()
                setCustomNames(prev => ({ ...prev, [idx]: val || autoTitle }))
                setEditingIdx(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
              }}
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: '13px',
                fontFamily: 'inherit',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '5px',
                outline: 'none',
                color: 'var(--text)',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <div
              onClick={() => scrollTo(idx, closeMobile)}
              onDoubleClick={() => setEditingIdx(idx)}
              title="Klicken zum Springen · Doppelklick zum Umbenennen"
              style={{
                display: 'block',
                padding: '5px 8px',
                borderRadius: '5px',
                fontSize: '13px',
                cursor: 'pointer',
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                background: isActive ? 'rgba(0,153,85,0.08)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                transition: 'color 0.15s, background 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.5,
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--muted)' }}
            >
              {displayName}
            </div>
          )}
        </div>
      )
    })
  }

  // Schwebendes Panel ueber dem Canvas, Default-Ort rechts neben der
  // Werkzeugleiste (CSS in globals.css). Per Griff (Kopfzeile) frei
  // verschiebbar, Position wird in localStorage gemerkt. Unter 1100px per
  // CSS ausgeblendet.
  return (
    <>
    {desktopCollapsed ? (
      <button
        type="button"
        className="outline-desktop-trigger"
        onClick={toggleDesktopCollapsed}
        aria-label="Blockliste öffnen"
        title="Blockliste öffnen"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      </button>
    ) : (
    <aside ref={panelRef as React.Ref<HTMLElement>} className="canvas-outline" style={{
      width: '190px',
      maxHeight: '56vh',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      padding: '10px 6px',
      background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      ...positionStyle,
    }}>
      <div
        onPointerDown={onHandlePointerDown}
        title="Ziehen zum Verschieben"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px 10px 8px',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <div style={{
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Blöcke
        </div>
        <button
          type="button"
          onClick={toggleDesktopCollapsed}
          aria-label="Blockliste einklappen"
          title="Blockliste einklappen"
          style={{
            width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: '5px', background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>

      {renderSections(false)}
    </aside>
    )}

    {/* Nur unter 1100px sichtbar (CSS): schwebender Button oeffnet die
        Blockliste als Drawer von rechts — gleiche UX wie das Artikel-TOC. */}
    <button
      type="button"
      className="outline-mobile-trigger"
      onClick={() => setMobileOpen(o => !o)}
      aria-label={mobileOpen ? 'Blockliste schließen' : 'Blockliste öffnen'}
      aria-expanded={mobileOpen}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    </button>

    <div
      className="outline-drawer-backdrop"
      data-open={mobileOpen || undefined}
      onClick={() => setMobileOpen(false)}
      aria-hidden="true"
    />

    <aside className="outline-drawer" data-open={mobileOpen || undefined}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Blöcke
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
      {renderSections(true)}
    </aside>
    </>
  )
}
