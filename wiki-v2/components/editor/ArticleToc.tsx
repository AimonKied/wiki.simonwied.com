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

  function scrollTo(idx: number) {
    const el = headingElements(containerSelector)[idx]
    if (!el) return
    setActiveIdx(idx)
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!entries.length) return null

  return (
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

        {entries.map(({ idx, level, text }) => {
          const isActive = idx === activeIdx
          return (
            <button
              key={idx}
              type="button"
              onClick={() => scrollTo(idx)}
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
        })}
      </div>
    </aside>
  )
}
