import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { PublishedNoteResult } from '@/lib/types'
import PublishedNoteView from '@/components/editor/PublishedNoteView'

export const dynamic = 'force-dynamic'

async function loadPublicNote(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('get_public_note', { p_slug: slug })
    .maybeSingle()
  return data as PublishedNoteResult | null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: slug } = await params
  const note = await loadPublicNote(slug)
  if (!note?.published) return {}

  const pub = note.published
  const title = pub.emoji ? `${pub.emoji} ${pub.title}` : pub.title
  const description = pub.description ?? undefined

  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function PublicNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('get_public_note', { p_slug: slug })
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

  return <PublishedNoteView note={note} access="public" isOwner={isOwner} />
}
