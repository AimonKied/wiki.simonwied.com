import Link from 'next/link'
import ThemeToggle from '@/components/theme/ThemeToggle'
import TrashOverview from '@/components/dashboard/TrashOverview'
import { listTrashedNotes } from '@/lib/notes/owner'

export const dynamic = 'force-dynamic'

export default async function TrashPage() {
  const notes = await listTrashedNotes()

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '32px' }}>
        <div className="dashboard-heading">
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px', fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>
            Papierkorb
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            <Link href="/dashboard" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Zurück zum Arbeitsbereich
            </Link>
          </p>
        </div>
        <div className="dashboard-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ThemeToggle />
        </div>
      </div>

      <TrashOverview notes={notes} />
    </div>
  )
}
