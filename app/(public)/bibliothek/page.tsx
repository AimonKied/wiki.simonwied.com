import Link from 'next/link'
import ThemeToggle from '@/components/theme/ThemeToggle'
import NoteCardGrid from '@/components/notes/NoteCardGrid'
import { listCategories, listPublicNotes } from '@/lib/notes/published'

export default async function HomePage() {
  const [categories, allPublicNotes] = await Promise.all([
    listCategories(),
    listPublicNotes(),
  ])

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
        <section style={{ marginBottom: '32px', width: '100%', maxWidth: 'min(100%, 1480px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
            <div style={{ minWidth: 'min(100%, 420px)', flex: '1 1 620px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>
                Bibliothek
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '760px', lineHeight: 1.7 }}>
                Öffentliche Artikel und Notizen.
              </p>
            </div>
            <ThemeToggle />
          </div>

          {/* Kategorien fuehren auf eigene Seiten statt auf ?category= --
              eine Kategorie ist eine eigene Adresse, die man verschicken kann. */}
          <div id="kategorien" style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }}>
              Kategorien
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {categories.map(category => {
                const count = allPublicNotes.filter(note => note.categories.some(c => c.slug === category.slug)).length
                return (
                  <Link
                    key={category.slug}
                    href={`/kategorie/${category.slug}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '7px 11px',
                      borderRadius: '999px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    {category.color && (
                      <span
                        aria-hidden="true"
                        style={{ width: '7px', height: '7px', borderRadius: '999px', background: category.color, flexShrink: 0 }}
                      />
                    )}
                    {category.title}
                    <span style={{ color: 'var(--muted)' }}>{count}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section id="oeffentlich" style={{ width: '100%', maxWidth: 'min(100%, 1480px)' }}>
          <h2 style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Inhalte
          </h2>
          <NoteCardGrid notes={allPublicNotes} />
        </section>
    </div>
  )
}
