'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createNote } from '@/lib/notes/create'

// Ein Klick legt den Artikel an und springt in den Editor — seit dem Wegfall
// des Canvas gibt es nur noch einen Inhaltstyp, also auch kein Auswahlmenue.
export default function NewContentButton() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function create() {
    setCreateError('')
    setCreating(true)
    try {
      const id = await createNote()
      router.push(`/notes/${id}/edit`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Artikel konnte nicht erstellt werden.')
      setCreating(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="new-content-button"
        onClick={create}
        disabled={creating}
        aria-label="Neuer Artikel"
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
          cursor: creating ? 'wait' : 'pointer',
          opacity: creating ? 0.7 : 1,
        }}
      >
        <span className="new-content-plus" aria-hidden="true">+</span>
        <span className="new-content-label">
          {creating ? 'Wird erstellt…' : 'Neuer Artikel'}
        </span>
      </button>

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
