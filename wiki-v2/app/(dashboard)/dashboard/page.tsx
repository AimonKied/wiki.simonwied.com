import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Note } from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isArticleContent(content: object | null | undefined) {
  if (!content || typeof content !== 'object') return false
  const doc = content as { attrs?: { wikiMode?: string }, content?: Array<{ type?: string }> }
  return doc.attrs?.wikiMode === 'article' || (!!doc.content?.length && doc.content.some(node => node.type !== 'section'))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{user?.email}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            href="/create?type=article"
            style={{
              padding: '9px 16px',
              background: 'var(--surface)',
              color: 'var(--accent)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            + Artikel
          </Link>
          <Link
            href="/create?type=workspace"
            style={{
              padding: '9px 16px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            + Workspace
          </Link>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Alle Inhalte ({notes?.length ?? 0})
        </h2>

        {!notes?.length ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '13px',
          }}>
            Noch keine Inhalte.{' '}
            <Link href="/create?type=article" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Ersten Artikel erstellen</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(notes as Note[]).map(note => {
              const isArticle = isArticleContent(note.content)
              return (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}/edit`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '14px 20px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: 'var(--text)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <span style={{ fontSize: '14px', color: 'var(--muted)' }}>{note.is_public ? 'O' : 'P'}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{note.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {isArticle ? 'Artikel' : 'Workspace'}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>
                    {formatDate(note.updated_at)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
