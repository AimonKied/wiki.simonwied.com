'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const OPTIONS = [
  {
    href: '/create?type=article',
    title: 'Artikel',
    description: 'Linearer Text fuer Guides, Rezepte, Cheatsheets und laengere Notizen.',
  },
  {
    href: '/create?type=workspace',
    title: 'Canvas Workspace',
    description: 'Freie Flaeche fuer strukturierte Bloecke, Skizzen und visuelle Arbeitsstaende.',
  },
]

export default function NewContentButton() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '9px 16px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Neuer Inhalt
        <span
          style={{
            fontSize: '10px',
            lineHeight: 1,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 20,
            width: 'min(88vw, 320px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '6px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            animation: 'fadeIn 0.12s ease both',
          }}
        >
          {OPTIONS.map(opt => {
            const isSelected = selected === opt.href
            return (
              <Link
                key={opt.href}
                href={opt.href}
                onClick={() => setSelected(opt.href)}
                style={{
                  display: 'block',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  background: isSelected ? 'var(--surface2)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '4px' }}>{opt.title}</div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.5 }}>
                  {opt.description}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
