'use client'

import { useState, useEffect } from 'react'

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

  useEffect(() => {
    setSections(extractSections(content))
  }, [content])

  // Scroll tracking — listen on the main scroll container
  useEffect(() => {
    const mainEl = document.querySelector('main')
    if (!mainEl) return

    function onScroll() {
      const cards = Array.from(document.querySelectorAll('[data-section-card]'))
      if (!cards.length) return
      const threshold = 160
      let active = 0
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].getBoundingClientRect().top <= threshold) active = i
      }
      setActiveIdx(active)
    }

    mainEl.addEventListener('scroll', onScroll, { passive: true })
    return () => mainEl.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(idx: number) {
    setActiveIdx(idx)
    // The editor pans its canvas viewport so the section lands centered in the workspace
    document.dispatchEvent(new CustomEvent('wiki-editor-focus-section', { detail: { idx } }))
  }

  if (!sections.length) return null

  return (
    <aside style={{
      width: '190px',
      flexShrink: 0,
      position: 'sticky',
      top: 40,
      alignSelf: 'flex-start',
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      paddingBottom: '40px',
    }}>
      <div style={{
        fontSize: '10px',
        color: 'var(--muted)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: '0 8px 12px',
      }}>
        Blöcke
      </div>

      {sections.map(({ idx, autoTitle }) => {
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
                onClick={() => scrollTo(idx)}
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
      })}
    </aside>
  )
}
