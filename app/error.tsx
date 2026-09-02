'use client'

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: '480px', textAlign: 'center' }}>
        <div style={{ fontSize: '42px', marginBottom: '16px' }} aria-hidden="true">!</div>
        <h1 style={{ fontSize: '22px', color: 'var(--accent)', marginBottom: '10px' }}>
          Etwas ist schiefgelaufen
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
          Die Seite konnte nicht geladen werden. Versuche es noch einmal.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{ padding: '10px 20px', border: 0, borderRadius: '8px', background: 'var(--accent)', color: '#fff', cursor: 'pointer', font: 'inherit', fontWeight: 700 }}
        >
          Erneut versuchen
        </button>
      </div>
    </main>
  )
}
