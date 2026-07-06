'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      router.push('/dashboard')
      router.refresh()
    } else {
      // E-Mail-Bestaetigung aktiv: keine Session direkt nach signUp
      setDone(true)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      zIndex: 1,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '400px',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text)', fontSize: '22px', fontWeight: 800 }}>
            Wiki<span style={{ color: 'var(--accent)' }}>.</span>
          </Link>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)' }}>
            Erstelle ein Konto, um eigene Notizen zu verwalten.
          </p>
        </div>

        {done ? (
          <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>
            Bestätigungslink verschickt. Bitte E-Mail-Postfach prüfen.
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                E-Mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="deine@email.de"
                className="ui-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="ui-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: '12px', color: 'var(--accent2)', padding: '10px 14px', background: '#fff0f2', border: '1px solid #ffd0d8', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '11px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'inherit',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Wird erstellt…' : 'Registrieren'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Link href="/login" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
            Schon ein Konto? Anmelden
          </Link>
          <Link href="/" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}
