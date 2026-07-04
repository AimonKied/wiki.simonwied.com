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
// Only structural article headings belong in the TOC, so H1 stays out.
function extractHeadings(content: object): TocEntry[] {
  const entries: TocEntry[] = []
  function walk(node: TipTapNode) {
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level) || 1
      const text = getText(node).trim()
      if (text && level >= 2) entries.push({ idx: entries.length, level, text })
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
  return Array.from(container.querySelectorAll<HTMLElement>('h2, h3'))
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
  const activeEntry = entries[activeIdx]
  const progress = entries.length > 1 ? activeIdx / (entries.length - 1) : 0

  useEffect(() => {
    setEntries(extractHeadings(content))
  }, [content])

  useEffect(() => {
    if (!entries.length) return

    const mainEl = document.querySelector('main') as HTMLElement | null
    const headings = headingElements(containerSelector)
    if (!headings.length) return

    let raf = 0

    function updateActive() {
      cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const threshold = (mainEl?.getBoundingClientRect().top ?? 0) + 140
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

  if (entries.length < 3) return null

  return (
    <aside style={{
      width: 'clamp(210px, 18vw, 260px)',
      flexShrink: 0,
      position: 'sticky',
      top: 24,
      alignSelf: 'flex-start',
      maxHeight: 'calc(100vh - 48px)',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      padding: '14px 14px 12px',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
      boxShadow: '0 16px 40px var(--shadow-faint)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '10px',
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Inhalt
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--accent)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'right',
          }}>
            {activeEntry?.text ?? ''}
          </div>
        </div>

        <div style={{
          height: '3px',
          borderRadius: '999px',
          background: 'var(--surface2)',
          overflow: 'hidden',
          marginBottom: '6px',
        }}>
          <div style={{
            width: `${Math.max(6, progress * 100)}%`,
            height: '100%',
            borderRadius: 'inherit',
            background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--accent3)))',
            transition: 'width 0.15s ease',
          }} />
        </div>

        <div style={{
          fontSize: '10px',
          color: 'var(--muted)',
          textAlign: 'right',
        }}>
          {activeIdx + 1} / {entries.length}
        </div>
      </div>

      <div style={{
        position: 'relative',
        display: 'grid',
        gap: '4px',
      }}>
        <div style={{
          position: 'absolute',
          left: '10px',
          top: '4px',
          bottom: '4px',
          width: '1px',
          background: 'var(--border)',
        }} />

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
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                width: '100%',
                padding: '8px 10px 8px 0',
                paddingLeft: `${8 + (level - 1) * 14}px`,
                borderRadius: '12px',
                border: 'none',
                background: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                boxShadow: isActive ? 'inset 2px 0 0 var(--accent)' : 'none',
                color: isActive ? 'var(--text)' : 'var(--muted)',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--muted)' }}
            >
              <span style={{
                position: 'absolute',
                left: '6px',
                top: '14px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isActive ? 'var(--accent)' : 'var(--border)',
                boxShadow: isActive ? '0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent)' : 'none',
                transition: 'background 0.15s, box-shadow 0.15s',
              }} />
              <span style={{
                display: 'block',
                fontSize: level === 1 ? '13px' : '12px',
                lineHeight: 1.45,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
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
