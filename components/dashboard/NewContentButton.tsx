'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createNote } from '@/lib/notes/create'
import { ARTICLE_TEMPLATES } from '@/lib/notes/templates'

// Geteilter Knopf: der Hauptteil legt sofort einen leeren Artikel an, der
// Pfeil oeffnet die Vorlagen. So bleibt der haeufigste Weg bei einem Klick,
// statt jedes Mal durch ein Menue zu fuehren.
export default function NewContentButton() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function create(templateKey: string) {
    setCreateError('')
    setCreating(true)
    setMenuOpen(false)
    try {
      const id = await createNote(templateKey)
      router.push(`/notes/${id}/edit`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Artikel konnte nicht erstellt werden.')
      setCreating(false)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="new-content-button"
        onClick={() => create('blank')}
        disabled={creating}
        aria-label="Neuer Artikel"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '9px 12px 9px 16px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px 0 0 8px',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: creating ? 'wait' : 'pointer',
          opacity: creating ? 0.7 : 1,
        }}
      >
        <span className="new-content-plus" aria-hidden="true">+</span>
        <span className="new-content-label">
          {creating ? 'Wird erstellt…' : 'Neuer Artikel'}
        </span>
      </button>
      {/* Unter 768px blendet globals.css .new-content-caret aus und rundet den
          Hauptknopf wieder voll -- auf dem Handy bleibt es beim Plus-Quadrat. */}
      <button
        type="button"
        className="new-content-caret"
        onClick={() => setMenuOpen(open => !open)}
        disabled={creating}
        aria-label="Vorlage wählen"
        aria-expanded={menuOpen}
        title="Vorlage wählen"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '30px',
          padding: 0,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.28)',
          borderRadius: '0 8px 8px 0',
          fontSize: '10px',
          fontFamily: 'inherit',
          cursor: creating ? 'wait' : 'pointer',
          opacity: creating ? 0.7 : 1,
        }}
      >
        <span aria-hidden="true" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          ▾
        </span>
      </button>

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 20,
            width: 'min(88vw, 320px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '6px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            animation: 'fadeIn 0.12s ease both',
          }}
        >
          {ARTICLE_TEMPLATES.map(template => (
            <button
              key={template.key}
              type="button"
              onClick={() => create(template.key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                fontFamily: 'inherit',
                padding: '10px 12px',
                borderRadius: '8px',
                color: 'var(--text)',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>
                {template.emoji ? `${template.emoji} ` : ''}{template.label}
              </div>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '11px', lineHeight: 1.5 }}>
                {template.description}
              </p>
            </button>
          ))}
        </div>
      )}

      {createError && (
        <p
          role="alert"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 20,
            margin: 0,
            width: 'max-content',
            maxWidth: 'min(88vw, 320px)',
            padding: '8px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--accent2)',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        >
          {createError}
        </p>
      )}
    </div>
  )
}
