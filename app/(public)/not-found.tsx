import Link from 'next/link'
import ThemeToggle from '@/components/theme/ThemeToggle'

export default function PublicNotFound() {
  return (
    <div style={{
      maxWidth: '480px',
      margin: '80px auto',
      padding: '40px',
      textAlign: 'center',
      animation: 'fadeIn 0.2s ease both',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: '-32px', right: 0 }}>
        <ThemeToggle />
      </div>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>404</div>
      <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px', color: 'var(--accent)' }}>
        Inhalt nicht verfügbar
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '28px' }}>
        Der Inhalt existiert nicht, ist nicht veröffentlicht oder der Freigabelink wurde widerrufen.
      </p>
      <Link
        href="/bibliothek"
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Zur Bibliothek
      </Link>
    </div>
  )
}
