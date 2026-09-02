import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PublishedNoteResult } from '@/lib/types'
import PublishedNoteView from '@/components/editor/PublishedNoteView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Geteilter Inhalt | Wiki',
  description: 'Ein privat geteilter Inhalt auf wiki.simonwied.com.',
  robots: { index: false, follow: false, noarchive: true },
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function SharedNotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID_PATTERN.test(token)) notFound()

  const supabase = await createClient()
  const { data } = await supabase
    .rpc('get_shared_note', { p_token: token })
    .maybeSingle()
  const note = data as PublishedNoteResult | null

  if (!note?.published) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === note.user_id
  if (isOwner) {
    await supabase
      .from('notes')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', note.note_id)
  }

  return <PublishedNoteView note={note} access="link" isOwner={isOwner} />
}
