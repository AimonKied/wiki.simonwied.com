import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar/Sidebar'
import Link from 'next/link'
import type { Category } from '@/lib/types'

const contentTypes = [
  {
    key: 'article',
    title: 'Artikel',
    label: 'Klassisch lesen',
    description: 'Lineare Seiten wie in v1: Rezepte, Guides, Cheatsheets und laengere Texte.',
    href: '/create?type=article',
    color: '#009955',
  },
  {
    key: 'workspace',
    title: 'Workspace Canvas',
    label: 'Frei anordnen',
    description: 'Visuelle Arbeitsflaechen mit beweglichen Bloecken, Pan, Zoom und Outline.',
    href: '/create?type=workspace',
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={!!user} />
      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', animation: 'fadeIn 0.2s ease both' }}>
        <section style={{ marginBottom: '40px', maxWidth: '980px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '34px', fontWeight: 800, marginBottom: '8px' }}>
              Simon&apos;s Wiki
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '620px', lineHeight: 1.7 }}>
              Oeffentliche Artikel und Canvas-Workspaces, sortiert nach Kategorien. Private Inhalte bleiben im Dashboard, oeffentliche Inhalte sind fuer alle lesbar.
            </p>
          </div>

          {user && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '32px' }}>
              {contentTypes.map(type => (
                <Link
                  key={type.key}
                  href={type.href}
                  style={{
                    display: 'block',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '18px 20px',
                    color: 'var(--text)',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800 }}>{type.title}</span>
                    <span style={{ fontSize: '10px', color: type.color, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {type.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>
                    {type.description}
                  </p>
                </Link>
              ))}
            </div>
          )}

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

        <section id="oeffentlich" style={{ maxWidth: '980px' }}>
          <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Oeffentliche Inhalte ({filteredNotes.length})
          </h2>

          {filteredNotes.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Keine Inhalte gefunden.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
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
