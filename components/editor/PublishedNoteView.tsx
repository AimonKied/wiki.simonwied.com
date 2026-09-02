import Link from 'next/link'
import type { PublishedNoteResult } from '@/lib/types'
import EditorViewer from './EditorViewer'
import ArticleToc from './ArticleToc'
import RightSidebar from './RightSidebar'
import NoteHeader from './NoteHeader'
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
  const isArticle = note.content_type === 'article'
  const accessLabel = access === 'public' ? 'Öffentlich' : 'Nur per Link'
  const typeLabel = isArticle ? 'Artikel' : 'Workspace Canvas'
  const visibleDate = note.published_at ?? note.updated_at

  return (
    <div
      className="note-editor-shell"
      data-content-type={isArticle ? 'article' : 'workspace'}
      style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both', flexWrap: 'wrap', width: '100%' }}
    >
      <div className="note-editor-main" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <NoteHeader
          emoji={pub.emoji ?? ''}
          title={pub.title}
          description={pub.description ?? ''}
          statusLabel={accessLabel}
          visibilityLabel={accessLabel}
          typeLabel={typeLabel}
          isArticle={isArticle}
          isPublic={access === 'public'}
          floating={!isArticle}
          editable={false}
          actions={<ThemeToggle />}
          meta={!isArticle && note.author_name ? (
            <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Von {note.author_name}
            </span>
          ) : undefined}
          linkRight={isOwner && (
            <Link
              href={`/notes/${note.note_id}/edit`}
              style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Bearbeiten →
            </Link>
          )}
        />

        {note.author_name && isArticle && (
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

        <EditorViewer content={pub.content} contentType={note.content_type} />
      </div>

      {!isArticle && pub.content && <RightSidebar content={pub.content} />}
      {isArticle && pub.content && <ArticleToc content={pub.content} />}
    </div>
  )
}
