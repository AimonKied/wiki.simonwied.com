import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Note } from '@/lib/types'

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

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{user?.email}</p>
        </div>
        <Link
          href="/notes/new"
          style={{
            padding: '9px 20px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          + Neue Notiz
        </Link>
      </div>

      <section>
        <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Alle Notizen ({notes?.length ?? 0})
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
            Noch keine Notizen.{' '}
            <Link href="/notes/new" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Erste Notiz erstellen →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(notes as Note[]).map(note => (
              <Link
                key={note.id}
                href={`/notes/${note.id}/edit`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: 'var(--text)',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--muted)' }}>{note.is_public ? '○' : '●'}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{note.title}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {formatDate(note.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
