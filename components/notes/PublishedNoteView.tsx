import Link from 'next/link'
import type { PublishedNoteResult } from '@/lib/notes/types'
import type { Backlink } from '@/lib/notes/published'
import EditorViewer from '@/components/editor/EditorViewer'
import ArticleToc from '@/components/editor/ArticleToc'
import NoteHeader from '@/components/editor/NoteHeader'
import ThemeToggle from '@/components/theme/ThemeToggle'

export default function PublishedNoteView({
  note,
  access,
  isOwner,
  backlinks = [],
}: {
  note: PublishedNoteResult
  access: 'public' | 'link'
  isOwner: boolean
  backlinks?: Backlink[]
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

        {/* Datum bleibt, die Autorenzeile ist mit profiles entfallen -- bei
            genau einem Autor stand auf jeder Seite derselbe Name. */}
        <div style={{ margin: '-8px 0 22px', fontSize: '12px', color: 'var(--muted)' }}>
          <span suppressHydrationWarning>
            {new Date(visibleDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <EditorViewer content={pub.content} />

        {backlinks.length > 0 && (
          <section style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Verlinkt von
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {backlinks.map(link => (
                <Link
                  key={link.id}
                  href={`/notes/${link.slug}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 10px', borderRadius: '7px',
                    color: 'var(--text)', textDecoration: 'none', fontSize: '13px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                  }}
                >
                  <span style={{ flexShrink: 0 }}>{link.emoji ?? '📄'}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {link.title}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {pub.content && <ArticleToc content={pub.content} />}
    </div>
  )
}
