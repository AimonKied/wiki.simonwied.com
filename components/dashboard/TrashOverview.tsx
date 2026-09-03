'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteUnreferencedMedia } from '@/lib/supabase/mediaCleanup'
import type { Note } from '@/lib/notes/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function TrashOverview({ notes: initialNotes }: { notes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmPurge, setConfirmPurge] = useState<Note | null>(null)
  const [error, setError] = useState('')

  async function restore(note: Note) {
    setError('')
    setPendingId(note.id)
    const { error: failure } = await createClient()
      .from('notes')
      .update({ deleted_at: null })
      .eq('id', note.id)
    setPendingId(null)
    if (failure) {
      setError(`Wiederherstellen fehlgeschlagen: ${failure.message}`)
      return
    }
    setNotes(current => current.filter(n => n.id !== note.id))
    document.dispatchEvent(new Event('wiki-notes-changed'))
  }

  async function purge(note: Note) {
    setError('')
    setPendingId(note.id)

    // Dateien zuerst: danach ist die Zeile weg und mit ihr die einzige Spur,
    // welche Dateien zu dieser Notiz gehoerten.
    const cleanup = await deleteUnreferencedMedia(
      note.content,
      note.cover_url ?? null,
      (note.published ?? null) as object | null,
      note.id,
    )

    const { error: failure } = await createClient().from('notes').delete().eq('id', note.id)
    setPendingId(null)
    if (failure) {
      setError(`Löschen fehlgeschlagen: ${failure.message}`)
      return
    }
    setNotes(current => current.filter(n => n.id !== note.id))
    setConfirmPurge(null)
    // Die Notiz ist weg; ein Fehler beim Aufraeumen ist kein Grund, das zu
    // verschweigen, aber auch keiner, das Loeschen als gescheitert zu melden.
    if (cleanup.error) setError(`Artikel gelöscht. ${cleanup.error}`)
    document.dispatchEvent(new Event('wiki-notes-changed'))
  }

  if (!notes.length) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: 'var(--muted)',
        fontSize: '13px',
      }}>
        Der Papierkorb ist leer.
      </div>
    )
  }

  return (
    <section>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Weggeworfene Artikel sind sofort offline und tauchen in keiner Liste mehr auf.
        Wiederherstellen bringt sie unverändert zurück, inklusive Veröffentlichung.
      </p>

      {error && (
        <p role="alert" style={{ margin: '0 0 12px', color: 'var(--accent2)', fontSize: '12px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {notes.map(note => (
          <div
            key={note.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
            }}
          >
            <span style={{ fontSize: '16px', flexShrink: 0, width: '22px', textAlign: 'center' }}>
              {note.emoji ?? '📄'}
            </span>
            <span style={{
              fontSize: '14px', fontWeight: 700, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: note.title ? 'var(--text)' : 'var(--muted)',
            }}>
              {note.title || 'Ohne Titel'}
            </span>
            {note.deleted_at && (
              <span suppressHydrationWarning style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>
                {formatDate(note.deleted_at)}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                disabled={pendingId === note.id}
                onClick={() => restore(note)}
                style={{
                  padding: '6px 12px', borderRadius: '7px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: '12px', fontFamily: 'inherit',
                  cursor: pendingId === note.id ? 'wait' : 'pointer',
                }}
              >
                Wiederherstellen
              </button>
              <button
                type="button"
                disabled={pendingId === note.id}
                onClick={() => setConfirmPurge(note)}
                style={{
                  padding: '6px 12px', borderRadius: '7px',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--accent2)', fontSize: '12px', fontFamily: 'inherit',
                  cursor: pendingId === note.id ? 'wait' : 'pointer',
                }}
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmPurge && (
        <div
          onClick={() => setConfirmPurge(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 220,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '380px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '18px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Endgültig löschen?</div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              „{confirmPurge.title || 'Ohne Titel'}“ wird unwiderruflich entfernt. Hochgeladene
              Bilder werden mitgelöscht, sofern kein anderer Artikel sie noch verwendet.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmPurge(null)}
                style={{
                  padding: '8px 12px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={pendingId === confirmPurge.id}
                onClick={() => purge(confirmPurge)}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: 'none',
                  background: 'var(--accent2)', color: '#fff',
                  cursor: pendingId === confirmPurge.id ? 'wait' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 700,
                }}
              >
                {pendingId === confirmPurge.id ? 'Wird gelöscht…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
