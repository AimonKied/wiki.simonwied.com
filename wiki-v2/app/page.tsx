import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar/Sidebar'
import Link from 'next/link'

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

const categories = [
  { slug: 'rezepte', label: 'Rezepte', color: '#bb7700' },
  { slug: 'security', label: 'Security', color: '#ff4466' },
  { slug: 'development', label: 'Development', color: '#f05033' },
  { slug: 'ressourcen', label: 'Ressourcen', color: '#7c3aed' },
]

const publicItems = [
  { title: 'Linsen mit Spaetzle', href: '/notes/linsen-mit-spaetzle', category: 'rezepte', type: 'article', description: 'Rezept aus dem alten Wiki.' },
  { title: 'Butter Chicken', href: '/notes/buttermilk-chicken', category: 'rezepte', type: 'article', description: 'Kochnotiz mit Zutaten und Ablauf.' },
  { title: 'Spanische Kroketten', href: '/notes/croquetas', category: 'rezepte', type: 'article', description: 'Rezept und Varianten.' },
  { title: 'Web Hacking', href: '/notes/web-hacking', category: 'security', type: 'article', description: 'Oeffentliche Security-Notizen.' },
  { title: 'CyberTools', href: '/notes/cybertools', category: 'security', type: 'article', description: 'Tool-Sammlung und Referenzen.' },
  { title: 'Git Commands', href: '/notes/git-commands', category: 'development', type: 'article', description: 'Git-Spickzettel fuer den Alltag.' },
]

function categoryBySlug(slug: string) {
  return categories.find(category => category.slug === slug)
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
  const filteredItems = publicItems.filter(item =>
    (!activeCategory || item.category === activeCategory) &&
    (!activeType || item.type === activeType)
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
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: category.color, display: 'inline-block' }} />
                  {category.label}
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
            Oeffentliche Inhalte ({filteredItems.length})
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
            {filteredItems.map(item => {
              const category = categoryBySlug(item.category)
              const type = contentTypes.find(entry => entry.key === item.type)
              return (
                <Link
                  key={item.href}
                  href={item.href}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '11px', color: 'var(--muted)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: category?.color ?? 'var(--muted)', display: 'inline-block' }} />
                    <span>{category?.label ?? item.category}</span>
                    <span>/</span>
                    <span>{type?.title ?? item.type}</span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>{item.title}</div>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
                    {item.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
