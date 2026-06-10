'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navSections = [
  {
    title: 'Navigation',
    items: [{ label: 'Startseite', href: '/', color: '#009955' }],
  },
  {
    title: 'Dashboard',
    items: [{ label: 'Alle Notizen', href: '/dashboard', color: '#009955' }],
  },
  {
    title: 'Security',
    items: [
      { label: 'Web Hacking', href: '/notes/web-hacking', color: '#ff4466' },
      { label: 'CyberTools',  href: '/notes/cybertools',  color: '#4488ff' },
    ],
  },
  {
    title: 'Development',
    items: [
      { label: 'Git Commands', href: '/notes/git-commands', color: '#f05033' },
    ],
  },
  {
    title: 'Rezepte',
    items: [
      { label: 'Linsen mit Spätzle',  href: '/notes/linsen-mit-spaetzle',  color: '#bb7700' },
      { label: 'Butter Chicken',      href: '/notes/buttermilk-chicken',    color: '#bb7700' },
      { label: 'Spanische Kroketten', href: '/notes/croquetas',             color: '#bb7700' },
    ],
  },
]

export default function Sidebar({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <nav style={{
      width: '260px',
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '28px 0',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text)', fontSize: '22px', fontWeight: 800 }}>
          Wiki<span style={{ color: 'var(--accent)' }}>.</span>
        </Link>
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1 }}>
        {navSections.map(section => (
          <div key={section.title} style={{ padding: '0 12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
              {section.title}
            </div>
            {section.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 8px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: pathname === item.href ? 'var(--text)' : 'var(--muted)',
                  background: pathname === item.href ? 'var(--surface2)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        {isLoggedIn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href="/notes/new" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>
              + Neue Notiz
            </Link>
            <button onClick={handleLogout} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              Abmelden
            </button>
          </div>
        ) : (
          <Link href="/login" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
            Anmelden →
          </Link>
        )}
        <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          wiki.simonwied.com
        </div>
      </div>
    </nav>
  )
}
