import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublishedNoteView from '@/components/notes/PublishedNoteView'
import { getPublicNote, recordOwnerVisit } from '@/lib/notes/published'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: slug } = await params
  const note = await getPublicNote(slug)
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
  const note = await getPublicNote(slug)

  if (!note?.published) notFound()
  const isOwner = await recordOwnerVisit(note)

  return <PublishedNoteView note={note} access="public" isOwner={isOwner} />
}
