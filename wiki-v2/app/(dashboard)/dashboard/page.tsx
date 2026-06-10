import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Willkommen zurück, {user?.email}
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
        <Link
          href="/notes/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
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

      {/* Notes grid placeholder */}
      <section>
        <h2 style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>
          Zuletzt bearbeitet
        </h2>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '13px',
        }}>
          Noch keine Notizen vorhanden.{' '}
          <Link href="/notes/new" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Erste Notiz erstellen →
          </Link>
        </div>
      </section>
    </div>
  )
}
