import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditorViewer from '@/components/editor/EditorViewer'
import ArticleToc from '@/components/editor/ArticleToc'
import RightSidebar from '@/components/editor/RightSidebar'
import NoteHeader from '@/components/editor/NoteHeader'
import ThemeToggle from '@/components/theme/ThemeToggle'

export default async function PublicNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params
  const supabase = await createClient()

  const { data: note } = await supabase
    .from('notes')
    .select('*')
    .eq('published->>slug', slug)
    .eq('is_public', true)
    .single()

  if (!note || !note.published) notFound()

  // Ansehen der eigenen Notiz zaehlt als "zuletzt verwendet" (Sidebar-Verlauf);
  // fuer fremde Besucher passiert nichts (RLS laesst nur Owner-Updates zu)
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === note.user_id
  if (isOwner) {
    await supabase
      .from('notes')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', note.id)
  }

  // Autor: oeffentlich lesbarer Anzeigename aus profiles (Spiegel der Auth-Daten)
  const { data: authorProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', note.user_id)
    .maybeSingle()
  const authorName = authorProfile?.display_name ?? null

  // Render the frozen public snapshot, not the owner's live draft.
  const pub = note.published as {
    title: string
    emoji: string | null
    description: string | null
    content: object | null
    slug: string | null
  }
  const isArticle = note.content_type === 'article'
  const typeLabel = isArticle ? 'Artikel' : 'Workspace Canvas'

  return (
    <div
      className="note-editor-shell"
      data-content-type={isArticle ? 'article' : 'workspace'}
      style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', animation: 'fadeIn 0.2s ease both', flexWrap: 'wrap', width: '100%' }}
    >
      <div className="note-editor-main" style={{ flex: 1, minWidth: 0 }}>

        <NoteHeader
          emoji={pub.emoji ?? ''}
          title={pub.title}
          description={pub.description ?? ''}
          statusLabel="Öffentlich"
          typeLabel={typeLabel}
          isArticle={isArticle}
          isPublic
          editable={false}
          actions={<ThemeToggle />}
          linkRight={isOwner && (
            <Link
              href={`/notes/${note.id}/edit`}
              style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Bearbeiten →
            </Link>
          )}
        />

        {authorName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '-8px 0 22px', fontSize: '12px', color: 'var(--muted)' }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
                color: 'var(--accent)',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
              }}
            >
              {authorName.charAt(0)}
            </span>
            <span>
              Von <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{authorName}</strong>
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>
              {new Date(note.updated_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        <EditorViewer content={pub.content} contentType={note.content_type as 'article' | 'workspace'} />

      </div>

      {!isArticle && pub.content && <RightSidebar content={pub.content} />}
      {isArticle && pub.content && <ArticleToc content={pub.content} />}
    </div>
  )
}
