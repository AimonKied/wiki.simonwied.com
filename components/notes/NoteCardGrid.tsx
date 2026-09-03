import Link from 'next/link'
import type { PublicNoteSummary } from '@/lib/notes/published'

// Kartenraster fuer oeffentliche Artikel. Von der Bibliothek und den
// Kategorie-Seiten gemeinsam genutzt, damit beide dieselbe Karte zeigen.
export default function NoteCardGrid({
  notes,
  empty = 'Keine Inhalte gefunden.',
}: {
  notes: PublicNoteSummary[]
  empty?: string
}) {
  if (!notes.length) {
    return <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{empty}</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '12px' }}>
      {notes.map(note => {
        const href = note.slug ? `/notes/${note.slug}` : `/notes/${note.id}`
        const meta = note.categories.map(cat => cat.title).join(' / ')
        return (
          <Link
            key={note.id}
            href={href}
            style={{
              display: 'block',
              minHeight: '118px',
              padding: '16px 18px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 750, marginBottom: note.description ? '5px' : 0 }}>
                  {note.emoji && <span style={{ marginRight: '6px' }}>{note.emoji}</span>}
                  {note.title}
                </div>
                {note.description && (
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
                    {note.description}
                  </p>
                )}
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
