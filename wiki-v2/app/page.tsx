import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar/Sidebar'
import Link from 'next/link'
import type { Category } from '@/lib/types'
import ThemeToggle from '@/components/theme/ThemeToggle'

const contentTypes = [
  {
    key: 'article',
    title: 'Artikel',
  },
  {
    key: 'workspace',
    title: 'Workspace Canvas',
  },
]

type PublicNote = {
  id: string
  title: string
  emoji: string | null
  description: string | null
  slug: string | null
  content_type: string
  updated_at: string
  categories: Category[]
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; type?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams
  const activeCategory = params?.category
  const activeType = params?.type

  // Load categories and public notes in parallel
  const [catsRes, notesRes] = await Promise.all([
    supabase.from('categories').select('*').order('position').order('title'),
    supabase
      .from('notes')
      .select(`
        id, title, emoji, description, slug, content_type, updated_at, published,
        note_categories(category_id, categories(id, slug, title, color))
      `)
      .eq('is_public', true)
      .order('updated_at', { ascending: false }),
  ])

  const categories: Category[] = (catsRes.data ?? []) as Category[]

  // Flatten the nested Supabase join result into a clean shape
  const allPublicNotes: PublicNote[] = (notesRes.data ?? []).map((n: Record<string, unknown>) => {
    // Public listing reflects the frozen snapshot, not the owner's live draft.
    const pub = (n.published ?? null) as {
      title?: string; emoji?: string | null; description?: string | null; slug?: string | null
    } | null
    return {
    id: n.id as string,
    title: pub?.title ?? (n.title as string),
    emoji: pub?.emoji ?? (n.emoji as string | null),
    description: pub?.description ?? (n.description as string | null),
    slug: pub?.slug ?? (n.slug as string | null),
    content_type: n.content_type as string,
    updated_at: n.updated_at as string,
    categories: ((n.note_categories as Array<{ categories: Category | null }>) ?? [])
      .map(nc => nc.categories)
      .filter((c): c is Category => c !== null),
    }
  })

  const filteredNotes = allPublicNotes.filter(note =>
    (!activeCategory || note.categories.some(c => c.slug === activeCategory)) &&
    (!activeType || note.content_type === activeType)
  )
  const activeCategoryTitle = activeCategory
    ? categories.find(category => category.slug === activeCategory)?.title
    : null
  const activeTypeTitle = activeType
    ? contentTypes.find(type => type.key === activeType)?.title
    : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={!!user} />
      <main style={{ flex: 1, padding: '32px clamp(22px, 3vw, 48px) 48px', overflowY: 'auto', animation: 'fadeIn 0.2s ease both', minWidth: 0 }}>
        <section style={{ marginBottom: '32px', width: '100%', maxWidth: 'min(100%, 1480px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
            <div style={{ minWidth: 'min(100%, 420px)', flex: '1 1 620px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
                Wiki
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '760px', lineHeight: 1.7 }}>
                Oeffentliche Notizen, Artikel und Workspaces.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div id="kategorien" style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }}>
              Kategorien
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                href="/"
                style={{
                  padding: '7px 11px',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  background: !activeCategory ? 'var(--surface2)' : 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '12px',
                  textDecoration: 'none',
                }}
              >
                Alle
              </Link>
              {categories.map(category => (
                <Link
                  key={category.slug}
                  href={`/?category=${category.slug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 11px',
                    borderRadius: '999px',
                    border: '1px solid var(--border)',
                    background: activeCategory === category.slug ? 'var(--surface2)' : 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '12px',
                    fontWeight: activeCategory === category.slug ? 700 : 500,
                    textDecoration: 'none',
                  }}
                >
                  {category.title}
                </Link>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {contentTypes.map(type => (
              <Link
                key={type.key}
                href={`/?type=${type.key}${activeCategory ? `&category=${activeCategory}` : ''}`}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: activeType === type.key ? 'var(--surface2)' : 'transparent',
                  color: activeType === type.key ? 'var(--text)' : 'var(--muted)',
                  fontSize: '12px',
                  textDecoration: 'none',
                }}
              >
                {type.title}
              </Link>
            ))}
          </div>
        </section>

        <section id="oeffentlich" style={{ width: '100%', maxWidth: 'min(100%, 1480px)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {activeCategoryTitle || activeTypeTitle ? 'Gefiltert' : 'Inhalte'}
            </h2>
            {(activeCategoryTitle || activeTypeTitle) && (
              <Link href="/" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
                Filter zuruecksetzen
              </Link>
            )}
          </div>

          {filteredNotes.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Keine Inhalte gefunden.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '12px' }}>
              {filteredNotes.map(note => {
                const href = note.slug ? `/notes/${note.slug}` : `/notes/${note.id}`
                const type = contentTypes.find(t => t.key === note.content_type)
                const meta = [...note.categories.map(cat => cat.title), type?.title ?? note.content_type].join(' / ')
                return (
                  <Link
                    key={note.id}
                    href={href}
                    style={{
                      display: 'block',
                      minHeight: '118px',
                      padding: '16px 18px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 750, marginBottom: note.description ? '5px' : 0 }}>
                          {note.emoji && <span style={{ marginRight: '6px' }}>{note.emoji}</span>}
                          {note.title}
                        </div>
                        {note.description && (
                          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
                            {note.description}
                          </p>
                        )}
                      </div>
                      <div style={{ marginTop: 'auto', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
                        {meta}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
