import Link from 'next/link'
import type { PublishedNoteResult } from '@/lib/notes/types'
import EditorViewer from '@/components/editor/EditorViewer'
import ArticleToc from '@/components/editor/ArticleToc'
import NoteHeader from '@/components/editor/NoteHeader'
import ThemeToggle from '@/components/theme/ThemeToggle'

export default function PublishedNoteView({
  note,
  access,
  isOwner,
}: {
  note: PublishedNoteResult
  access: 'public' | 'link'
  isOwner: boolean
}) {
  const pub = note.published
  const accessLabel = access === 'public' ? 'Öffentlich' : 'Nur per Link'
  const visibleDate = note.published_at ?? note.updated_at

  return (
    <div
      className="note-editor-shell"
      style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both', flexWrap: 'wrap', width: '100%' }}
    >
      <div className="note-editor-main" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <NoteHeader
          emoji={pub.emoji ?? ''}
          title={pub.title}
          description={pub.description ?? ''}
          statusLabel={accessLabel}
          visibilityLabel={accessLabel}
          typeLabel="Artikel"
          isPublic={access === 'public'}
          coverUrl={pub.cover ?? null}
          editable={false}
          actions={<ThemeToggle />}
          linkRight={isOwner && (
            <Link
              href={`/notes/${note.note_id}/edit`}
              style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Bearbeiten →
            </Link>
          )}
        />

        {note.author_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '-8px 0 22px', fontSize: '12px', color: 'var(--muted)' }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
                color: 'var(--accent)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
              }}
            >
              {note.author_name.charAt(0)}
            </span>
            <span>Von <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{note.author_name}</strong></span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span suppressHydrationWarning>
              {new Date(visibleDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        <EditorViewer content={pub.content} />
      </div>

      {pub.content && <ArticleToc content={pub.content} />}
    </div>
  )
}
