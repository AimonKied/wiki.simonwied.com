import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar/Sidebar'
import Link from 'next/link'
import type { Category } from '@/lib/types'
import ThemeToggle from '@/components/theme/ThemeToggle'

const contentTypes = [
  {
    key: 'article',
    title: 'Artikel',
    color: '#009955',
  },
  {
    key: 'workspace',
    title: 'Workspace Canvas',
    color: '#4488ff',
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
    supabase.from('categories').select('*').order('title'),
    supabase
      .from('notes')
      .select(`
        id, title, emoji, description, slug, content_type, updated_at,
        note_categories(category_id, categories(id, slug, title, color))
      `)
      .eq('is_public', true)
      .order('updated_at', { ascending: false }),
  ])

  const categories: Category[] = (catsRes.data ?? []) as Category[]

  // Flatten the nested Supabase join result into a clean shape
  const allPublicNotes: PublicNote[] = (notesRes.data ?? []).map((n: Record<string, unknown>) => ({
    id: n.id as string,
    title: n.title as string,
    emoji: n.emoji as string | null,
    description: n.description as string | null,
    slug: n.slug as string | null,
    content_type: n.content_type as string,
    updated_at: n.updated_at as string,
    categories: ((n.note_categories as Array<{ categories: Category | null }>) ?? [])
      .map(nc => nc.categories)
      .filter((c): c is Category => c !== null),
  }))

  const filteredNotes = allPublicNotes.filter(note =>
    (!activeCategory || note.categories.some(c => c.slug === activeCategory)) &&
    (!activeType || note.content_type === activeType)
  )
  const articleCount = allPublicNotes.filter(note => note.content_type === 'article').length
  const workspaceCount = allPublicNotes.filter(note => note.content_type === 'workspace').length
  const activeCategoryTitle = activeCategory
    ? categories.find(category => category.slug === activeCategory)?.title
    : null
  const activeTypeTitle = activeType
    ? contentTypes.find(type => type.key === activeType)?.title
    : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={!!user} />
      <main style={{ flex: 1, padding: '32px clamp(22px, 3vw, 40px) 48px', overflowY: 'auto', animation: 'fadeIn 0.2s ease both', minWidth: 0 }}>
        <section style={{ marginBottom: '40px', width: '100%', maxWidth: '1440px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
            <div style={{ minWidth: 'min(100%, 420px)', flex: '1 1 620px' }}>
              <h1 style={{ fontSize: '34px', fontWeight: 800, marginBottom: '8px' }}>
                Bibliothek
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '760px', lineHeight: 1.7 }}>
                Oeffentliche Artikel und Workspaces, sortiert nach Thema und Inhaltstyp.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '10px', marginBottom: '28px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>{allPublicNotes.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Oeffentliche Inhalte</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent3)' }}>{articleCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Artikel</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent4)' }}>{workspaceCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Workspaces</div>
            </div>
          </div>

          <div id="kategorien" style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
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
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: category.color ?? 'var(--muted)', display: 'inline-block' }} />
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

        <section id="oeffentlich" style={{ width: '100%', maxWidth: '1440px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {activeCategoryTitle || activeTypeTitle ? 'Gefilterte Inhalte' : 'Neueste Inhalte'} ({filteredNotes.length})
            </h2>
            {(activeCategoryTitle || activeTypeTitle) && (
              <Link href="/" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>
                Filter zuruecksetzen
              </Link>
            )}
          </div>

          {filteredNotes.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Keine Inhalte gefunden.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '12px' }}>
              {filteredNotes.map(note => {
                const href = note.slug ? `/notes/${note.slug}` : `/notes/${note.id}`
                const type = contentTypes.find(t => t.key === note.content_type)
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '11px', color: 'var(--muted)', flexWrap: 'wrap' }}>
                      {note.categories.map((cat, i) => (
                        <span key={cat.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          {i > 0 && <span style={{ color: 'var(--border)' }}>·</span>}
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cat.color ?? 'var(--muted)', display: 'inline-block' }} />
                          {cat.title}
                        </span>
                      ))}
                      {note.categories.length > 0 && <span style={{ color: 'var(--border)' }}>/</span>}
                      <span>{type?.title ?? note.content_type}</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>
                      {note.emoji && <span style={{ marginRight: '6px' }}>{note.emoji}</span>}
                      {note.title}
                    </div>
                    {note.description && (
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
                        {note.description}
                      </p>
                    )}
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
