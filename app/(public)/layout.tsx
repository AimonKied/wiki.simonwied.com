import Sidebar from '@/components/sidebar/Sidebar'
import { getOwnerSession } from '@/lib/auth/session'
import { listRecentOwnerNotes } from '@/lib/notes/owner'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, isOwner } = await getOwnerSession()
  const notes = isOwner && user ? await listRecentOwnerNotes(user.id) : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={isOwner} notes={notes} />
      <main className="app-main" style={{ overflowY: 'visible' }}>
        {children}
      </main>
    </div>
  )
}
