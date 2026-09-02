import Link from 'next/link'
import ThemeToggle from '@/components/theme/ThemeToggle'

export default function SharedNoteNotFound() {
  return (
    <div style={{ maxWidth: '480px', margin: '80px auto', padding: '40px', textAlign: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-32px', right: 0 }}><ThemeToggle /></div>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>404</div>
      <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px', color: 'var(--accent)' }}>
        Freigabelink nicht gültig
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '28px' }}>
        Der Link ist falsch, wurde widerrufen oder durch einen neuen Link ersetzt.
      </p>
      <Link href="/" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--accent)', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
        Zur Startseite
      </Link>
    </div>
  )
}
