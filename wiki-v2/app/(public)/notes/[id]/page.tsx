import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditorViewer from '@/components/editor/EditorViewer'
import ArticleToc from '@/components/editor/ArticleToc'
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
  if (user?.id === note.user_id) {
    await supabase
      .from('notes')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', note.id)
  }

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
    <div style={{ width: '100%', maxWidth: isArticle ? '1240px' : '860px', animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            wiki.simonwied.com
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pub.title}</span>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: '999px',
            background: 'var(--surface)',
            color: 'var(--muted)',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isArticle ? '#009955' : '#4488ff' }} />
            {typeLabel}
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: '999px',
            background: 'var(--surface)',
            color: 'var(--muted)',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
            Öffentlich
          </span>
        </div>
        {pub.emoji && <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>{pub.emoji}</span>}
        <h1 style={{
          fontSize: '42px',
          fontWeight: 800,
          marginBottom: '12px',
          letterSpacing: '0.01em',
          lineHeight: 1.1,
          color: 'var(--accent)',
          fontFamily: 'var(--font-display)',
        }}>
          {pub.title}
        </h1>
        {pub.description && (
          <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
            {pub.description}
          </p>
        )}
      </div>

      {isArticle && pub.content ? (
        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <EditorViewer content={pub.content} contentType="article" />
          </div>
          <ArticleToc content={pub.content} />
        </div>
      ) : (
        <EditorViewer content={pub.content} contentType={note.content_type as 'article' | 'workspace'} />
      )}
    </div>
  )
}
