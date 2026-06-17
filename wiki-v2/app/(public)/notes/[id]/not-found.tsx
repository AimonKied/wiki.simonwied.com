import Link from 'next/link'

export default function NoteNotFound() {
  return (
    <div style={{
      maxWidth: '480px',
      margin: '80px auto',
      padding: '40px',
      textAlign: 'center',
      animation: 'fadeIn 0.2s ease both',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>404</div>
      <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px', color: 'var(--accent)' }}>
        Seite nicht gefunden
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '28px' }}>
        Diese Seite existiert nicht oder wurde entfernt.
      </p>
      <Link
        href="/"
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
        Zur Startseite
      </Link>
    </div>
  )
}
