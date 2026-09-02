import Link from 'next/link'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { listCategories, listPublicNotes } from '@/lib/notes/published'

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

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; type?: string }>
}) {
  const params = await searchParams
  const activeCategory = params?.category
  const activeType = params?.type

  const [categories, allPublicNotes] = await Promise.all([
    listCategories(),
    listPublicNotes(),
  ])

  const filteredNotes = allPublicNotes.filter(note =>
    (!activeCategory || note.categories.some(c => c.slug === activeCategory)) &&
    (!activeType || note.contentType === activeType)
  )
  const activeCategoryTitle = activeCategory
    ? categories.find(category => category.slug === activeCategory)?.title
    : null
  const activeTypeTitle = activeType
    ? contentTypes.find(type => type.key === activeType)?.title
    : null

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
        <section style={{ marginBottom: '32px', width: '100%', maxWidth: 'min(100%, 1480px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
            <div style={{ minWidth: 'min(100%, 420px)', flex: '1 1 620px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>
                Bibliothek
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '760px', lineHeight: 1.7 }}>
                Öffentliche Notizen, Artikel und Workspaces.
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
                href="/bibliothek"
                style={{
                  padding: '7px 11px',
                  borderRadius: '999px',
                  border: `1px solid ${!activeCategory ? 'var(--accent)' : 'var(--border)'}`,
                  background: !activeCategory ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface)',
                  color: !activeCategory ? 'var(--accent)' : 'var(--text)',
                  fontSize: '12px',
                  fontWeight: !activeCategory ? 700 : 500,
                  textDecoration: 'none',
                }}
              >
                Alle
              </Link>
              {categories.map(category => (
                <Link
                  key={category.slug}
                  href={`/bibliothek?category=${category.slug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 11px',
                    borderRadius: '999px',
                    border: `1px solid ${activeCategory === category.slug ? 'var(--accent)' : 'var(--border)'}`,
                    background: activeCategory === category.slug ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface)',
                    color: activeCategory === category.slug ? 'var(--accent)' : 'var(--text)',
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
            {contentTypes.map(type => {
              const isActive = activeType === type.key
              // Re-clicking the active type clears the filter (show all)
              const params = new URLSearchParams()
              if (!isActive) params.set('type', type.key)
              if (activeCategory) params.set('category', activeCategory)
              const query = params.toString()
              return (
              <Link
                key={type.key}
                href={query ? `/bibliothek?${query}` : '/bibliothek'}
                style={{
                  padding: '7px 11px',
                  borderRadius: '999px',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  background: isActive ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface)',
                  color: isActive ? 'var(--accent)' : 'var(--text)',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                }}
              >
                {type.title}
              </Link>
              )
            })}
          </div>
        </section>

        <section id="oeffentlich" style={{ width: '100%', maxWidth: 'min(100%, 1480px)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {activeCategoryTitle || activeTypeTitle ? 'Gefiltert' : 'Inhalte'}
            </h2>
            {(activeCategoryTitle || activeTypeTitle) && (
              <Link href="/bibliothek" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
                Filter zurücksetzen
              </Link>
            )}
          </div>

          {filteredNotes.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Keine Inhalte gefunden.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '12px' }}>
              {filteredNotes.map(note => {
                const href = note.slug ? `/notes/${note.slug}` : `/notes/${note.id}`
                const type = contentTypes.find(t => t.key === note.contentType)
                const meta = [...note.categories.map(cat => cat.title), type?.title ?? note.contentType].join(' / ')
                const byline = note.author ? `Von ${note.author}` : null
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
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
                        {byline && <span style={{ flexShrink: 0 }}>{byline}</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
    </div>
  )
}
