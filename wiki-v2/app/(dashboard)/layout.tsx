import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar/Sidebar'
import type { Note } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // "Zuletzt"-Startwert fuer die Sidebar: nur wirklich geoeffnete Notizen
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, emoji, content_type, is_public, slug, updated_at')
    .not('last_opened_at', 'is', null)
    .order('last_opened_at', { ascending: false })
    .limit(8)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={true} notes={(notes ?? []) as Note[]} />
      <main style={{ flex: 1, minWidth: 0, padding: '32px clamp(22px, 3vw, 48px) 48px', overflowY: 'visible' }}>
        {children}
      </main>
    </div>
  )
}
