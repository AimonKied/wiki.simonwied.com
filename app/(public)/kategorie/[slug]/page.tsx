import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ThemeToggle from '@/components/theme/ThemeToggle'
import NoteCardGrid from '@/components/notes/NoteCardGrid'
import { listCategories, listPublicNotes } from '@/lib/notes/published'

export const dynamic = 'force-dynamic'

async function findCategory(slug: string) {
  const categories = await listCategories()
  return categories.find(category => category.slug === slug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const category = await findCategory(slug)
  if (!category) return {}
  return {
    title: category.title,
    description: `Öffentliche Artikel in der Kategorie ${category.title}.`,
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [category, allPublicNotes] = await Promise.all([
    findCategory(slug),
    listPublicNotes(),
  ])

  // Unbekannter Slug ist ein 404 und keine leere Liste: sonst sieht ein Tippfehler
  // in der Adresse aus wie eine Kategorie ohne Inhalte.
  if (!category) notFound()

  const notes = allPublicNotes.filter(note => note.categories.some(c => c.slug === slug))

  return (
    <div style={{ animation: 'fadeIn 0.2s ease both' }}>
      <section style={{ marginBottom: '32px', width: '100%', maxWidth: 'min(100%, 1480px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <div style={{ minWidth: 'min(100%, 420px)', flex: '1 1 620px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              {category.color && (
                <span
                  aria-hidden="true"
                  style={{ width: '10px', height: '10px', borderRadius: '999px', background: category.color, flexShrink: 0 }}
                />
              )}
              <h1 style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.01em', margin: 0 }}>
                {category.title}
              </h1>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.7 }}>
              {notes.length === 1 ? '1 Artikel' : `${notes.length} Artikel`}
              {' · '}
              <Link href="/bibliothek" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Alle Kategorien
              </Link>
            </p>
          </div>
          <ThemeToggle />
        </div>

        <NoteCardGrid notes={notes} empty="In dieser Kategorie ist noch nichts veröffentlicht." />
      </section>
    </div>
  )
}
