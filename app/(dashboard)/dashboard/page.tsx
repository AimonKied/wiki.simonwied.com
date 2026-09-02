import ThemeToggle from '@/components/theme/ThemeToggle'
import NewContentButton from '@/components/dashboard/NewContentButton'
import NotesOverview from '@/components/dashboard/NotesOverview'
import { getOwnerSession } from '@/lib/auth/session'
import { listOwnerNotes } from '@/lib/notes/owner'

export default async function DashboardPage() {
  const [{ user }, allNotes] = await Promise.all([
    getOwnerSession(),
    listOwnerNotes(),
  ])

  const displayName = (user?.user_metadata?.display_name as string | undefined)?.trim() || null

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '32px' }}>
        <div className="dashboard-heading">
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px', fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>
            {displayName ? `Hallo, ${displayName}` : 'Arbeitsbereich'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            Inhalte erstellen, bearbeiten und öffentlich oder per Geheimlink freigeben.
            {user?.email && <span style={{ display: 'block', fontSize: '12px' }}>{user.email}</span>}
          </p>
        </div>
        <div className="dashboard-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ThemeToggle />
          <NewContentButton />
        </div>
      </div>

      <NotesOverview notes={allNotes} />
    </div>
  )
}
