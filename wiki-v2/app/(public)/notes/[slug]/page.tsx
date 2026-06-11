import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const Editor = dynamic(() => import('@/components/editor/Editor'), { ssr: false })

export default async function PublicNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: note } = await supabase
    .from('notes')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (!note) notFound()

  return (
    <div style={{ maxWidth: '860px', animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ marginBottom: '8px' }}>
        <Link href="/" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
          ← Startseite
        </Link>
      </div>
      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
        {note.title}
      </h1>
      <Editor content={note.content} editable={false} />
    </div>
  )
}
