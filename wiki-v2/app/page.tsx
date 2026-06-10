import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar/Sidebar'
import Link from 'next/link'

const sections = [
  {
    title: 'Security',
    color: '#ff4466',
    notes: [
      { label: 'Web Hacking', href: '/notes/web-hacking' },
      { label: 'CyberTools',  href: '/notes/cybertools' },
    ],
  },
  {
    title: 'Development',
    color: '#f05033',
    notes: [
      { label: 'Git Commands', href: '/notes/git-commands' },
    ],
  },
  {
    title: 'Rezepte',
    color: '#bb7700',
    notes: [
      { label: 'Linsen mit Spätzle',  href: '/notes/linsen-mit-spaetzle' },
      { label: 'Butter Chicken',       href: '/notes/buttermilk-chicken' },
      { label: 'Spanische Kroketten',  href: '/notes/croquetas' },
    ],
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar isLoggedIn={!!user} />
      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', animation: 'fadeIn 0.2s ease both' }}>
        {/* Hero */}
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Simon&apos;s Wiki
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '480px' }}>
            Persönliche Notizen, Rezepte und Wissen — strukturiert und durchsuchbar.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sections.map(section => (
            <div
              key={section.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: section.color, display: 'inline-block' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {section.title}
                </span>
              </div>
              <div style={{ padding: '8px 0' }}>
                {section.notes.map(note => (
                  <Link
                    key={note.href}
                    href={note.href}
                    style={{
                      display: 'block',
                      padding: '10px 24px',
                      fontSize: '14px',
                      color: 'var(--text)',
                      textDecoration: 'none',
                    }}
                  >
                    {note.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
