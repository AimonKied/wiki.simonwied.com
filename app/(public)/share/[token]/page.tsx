import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublishedNoteView from '@/components/notes/PublishedNoteView'
import { getSharedNote, recordOwnerVisit } from '@/lib/notes/published'

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

  const note = await getSharedNote(token)

  if (!note?.published) notFound()
  const isOwner = await recordOwnerVisit(note)

  return <PublishedNoteView note={note} access="link" isOwner={isOwner} />
}
