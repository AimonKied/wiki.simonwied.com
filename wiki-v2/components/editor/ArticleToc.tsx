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
// The order matches querySelectorAll('h1, h2, h3') on the rendered editor DOM.
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

  // Scroll tracking — depending on the layout either <main> or the window scrolls
  useEffect(() => {
    const mainEl = document.querySelector('main')

    function onScroll() {
      const headings = headingElements(containerSelector)
      if (!headings.length) return
      const threshold = 160
      let active = 0
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= threshold) active = i
      }
      setActiveIdx(active)
    }

    mainEl?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      mainEl?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
    }
  }, [containerSelector])

  function scrollTo(idx: number) {
    const el = headingElements(containerSelector)[idx]
    if (!el) return
    setActiveIdx(idx)
    el.style.scrollMarginTop = '24px'
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!entries.length) return null

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
        Inhalt
      </div>

      {entries.map(({ idx, level, text }) => {
        const isActive = idx === activeIdx
        return (
          <div
            key={idx}
            onClick={() => scrollTo(idx)}
            title={text}
            style={{
              display: 'block',
              padding: '5px 8px',
              paddingLeft: `${8 + (level - 1) * 12}px`,
              borderRadius: '5px',
              fontSize: level === 1 ? '13px' : '12px',
              cursor: 'pointer',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              background: isActive ? 'rgba(0,153,85,0.08)' : 'transparent',
              fontWeight: isActive ? 600 : level === 1 ? 500 : 400,
              transition: 'color 0.15s, background 0.15s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.5,
              userSelect: 'none',
              marginBottom: '2px',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--muted)' }}
          >
            {text}
          </div>
        )
      })}
    </aside>
  )
}
