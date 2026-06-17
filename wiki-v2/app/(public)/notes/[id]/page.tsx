import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditorViewer from '@/components/editor/EditorViewer'

export default async function PublicNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params
  const supabase = await createClient()

  const { data: note } = await supabase
    .from('notes')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (!note) notFound()
  const isArticle = note.content_type === 'article'

  return (
    <div style={{ maxWidth: isArticle ? '1040px' : '860px', animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ marginBottom: '32px', fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
          wiki.simonwied.com
        </Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>{note.title}</span>
      </div>

      <div style={{ marginBottom: '40px' }}>
        {note.emoji && <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>{note.emoji}</span>}
        <h1 style={{
          fontSize: '42px',
          fontWeight: 800,
          marginBottom: '12px',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: 'var(--accent)',
        }}>
          {note.title}
        </h1>
        {note.description && (
          <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
            {note.description}
          </p>
        )}
      </div>

      <EditorViewer content={note.content} />
    </div>
  )
}
