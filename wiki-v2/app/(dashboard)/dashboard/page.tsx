import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Note } from '@/lib/types'
import ThemeToggle from '@/components/theme/ThemeToggle'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })
  const allNotes = (notes ?? []) as Note[]
  const publicCount = allNotes.filter(note => note.is_public).length
  const articleCount = allNotes.filter(note => note.content_type === 'article').length
  const workspaceCount = allNotes.filter(note => note.content_type === 'workspace').length

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Arbeitsbereich</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            Inhalte erstellen, bearbeiten und fuer die oeffentliche Startseite freigeben.
            {user?.email && <span style={{ display: 'block', fontSize: '12px' }}>{user.email}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ThemeToggle />
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '10px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{allNotes.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Alle Inhalte</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>{publicCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Oeffentlich</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent3)' }}>{articleCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Artikel</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent4)' }}>{workspaceCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Workspaces</div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Zuletzt bearbeitet
        </h2>

        {!allNotes.length ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '13px',
          }}>
            Noch keine Inhalte. Starte mit einem{' '}
            <Link href="/create?type=article" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Artikel</Link>
            {' '}oder einem{' '}
            <Link href="/create?type=workspace" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Workspace</Link>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allNotes.map(note => {
              const isArticle = note.content_type === 'article'
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
