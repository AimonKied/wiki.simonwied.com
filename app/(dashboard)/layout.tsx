import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar/Sidebar'
import { getOwnerSession } from '@/lib/auth/session'
import { listRecentOwnerNotes } from '@/lib/notes/owner'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isOwner } = await getOwnerSession()

  if (!user) redirect('/login')
  if (!isOwner) redirect('/login?error=forbidden')

  // "Zuletzt"-Startwert fuer die Sidebar: nur wirklich geoeffnete Notizen
  const notes = await listRecentOwnerNotes(user.id)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={true} notes={notes} />
      <main className="app-main" style={{ overflowY: 'visible' }}>
        {children}
      </main>
    </div>
  )
}
