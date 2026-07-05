'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createNote } from '@/lib/createNote'

const OPTIONS: Array<{ type: 'article' | 'workspace'; title: string; description: string }> = [
  {
    type: 'article',
    title: 'Artikel',
    description: 'Linearer Text fuer Guides, Rezepte, Cheatsheets und laengere Notizen.',
  },
  {
    type: 'workspace',
    title: 'Canvas Workspace',
    description: 'Freie Flaeche fuer strukturierte Bloecke, Skizzen und visuelle Arbeitsstaende.',
  },
]

export default function NewContentButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
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
            const isCreating = creating === opt.type
            return (
              <button
                key={opt.type}
                type="button"
                disabled={creating !== null}
                onClick={async () => {
                  setCreating(opt.type)
                  const id = await createNote(opt.type)
                  setCreating(null)
                  setOpen(false)
                  if (id) router.push(`/notes/${id}/edit`)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  fontFamily: 'inherit',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  background: isCreating ? 'var(--surface2)' : 'transparent',
                  cursor: creating ? 'wait' : 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!creating) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!creating) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '4px' }}>
                  {isCreating ? 'Wird erstellt…' : opt.title}
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.5 }}>
                  {opt.description}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
