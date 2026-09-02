import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar/Sidebar'
import type { Note } from '@/lib/notes/types'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: ownerResult } = user
    ? await supabase.rpc('is_wiki_owner')
    : { data: false }
  const isOwner = ownerResult === true
  const { data: notes } = isOwner
    ? await supabase
      .from('notes')
      .select('id, title, emoji, content_type, visibility, is_public, slug, updated_at')
      .eq('user_id', user!.id)
      .not('last_opened_at', 'is', null)
      .order('last_opened_at', { ascending: false })
      .limit(8)
    : { data: [] }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={isOwner} notes={(notes ?? []) as Note[]} />
      <main className="app-main" style={{ overflowY: 'visible' }}>
        {children}
      </main>
    </div>
  )
}
