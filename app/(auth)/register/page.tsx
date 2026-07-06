'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Supabase liefert englische Fehlertexte — die haeufigsten uebersetzen,
// Rest als Fallback durchreichen
function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Diese E-Mail-Adresse ist bereits registriert. Melde dich stattdessen an.'
  }
  if (m.includes('password should be at least')) {
    return 'Das Passwort ist zu kurz.'
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Bitte eine gültige E-Mail-Adresse eingeben.'
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Zu viele Versuche. Bitte kurz warten und erneut probieren.'
  }
  if (m.includes('signup') && m.includes('disabled')) {
    return 'Die Registrierung ist derzeit deaktiviert.'
  }
  return message
}

const MIN_PASSWORD_LENGTH = 8

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--muted)',
  marginBottom: '6px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
      style={{
        position: 'absolute',
        right: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        background: 'none',
        border: 'none',
        padding: '4px',
        cursor: 'pointer',
        color: 'var(--muted)',
      }}
    >
      {visible ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  )
}

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const router = useRouter()

  // Cooldown-Ticker fuer "Erneut senden"
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const passwordsMismatch = passwordConfirm.length > 0 && password !== passwordConfirm

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`)
      return
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
        data: { display_name: displayName.trim() },
      },
    })

    if (error) {
      setError(translateAuthError(error.message))
      setLoading(false)
      return
    }

    // Supabase meldet bei bereits registrierter (bestaetigter) E-Mail keinen
    // Fehler, sondern einen User ohne Identities — abfangen statt still schlucken
    if (data.user && data.user.identities?.length === 0) {
      setError('Diese E-Mail-Adresse ist bereits registriert. Melde dich stattdessen an.')
      setLoading(false)
      return
    }

    if (data.session) {
      // E-Mail-Bestaetigung deaktiviert: direkt eingeloggt
      router.push('/dashboard')
      router.refresh()
    } else {
      setRegisteredEmail(email)
      setResendCooldown(60)
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!registeredEmail || resendCooldown > 0) return
    setResendStatus('idle')
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: registeredEmail,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    })
    setResendStatus(error ? 'error' : 'sent')
    setResendCooldown(60)
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
            {registeredEmail ? 'Fast geschafft!' : 'Erstelle ein Konto, um eigene Notizen zu verwalten.'}
          </p>
        </div>

        {registeredEmail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>
              Wir haben einen Bestätigungslink an{' '}
              <strong style={{ overflowWrap: 'anywhere' }}>{registeredEmail}</strong> geschickt.
              Öffne die E-Mail und klicke auf den Link, um dein Konto zu aktivieren.
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
              Keine E-Mail erhalten? Prüfe auch den Spam-Ordner.
            </div>
            {resendStatus === 'sent' && (
              <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
                Neue Bestätigungs-E-Mail verschickt.
              </div>
            )}
            {resendStatus === 'error' && (
              <div style={{ fontSize: '12px', color: 'var(--accent2)' }}>
                Senden fehlgeschlagen. Bitte später erneut versuchen.
              </div>
            )}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              style={{
                padding: '10px',
                background: 'none',
                color: resendCooldown > 0 ? 'var(--muted)' : 'var(--accent)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'inherit',
                fontWeight: 600,
                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {resendCooldown > 0 ? `Erneut senden (${resendCooldown}s)` : 'Bestätigungslink erneut senden'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Anzeigename</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                maxLength={50}
                autoComplete="name"
                placeholder="Wie sollen wir dich nennen?"
                className="ui-input"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="deine@email.de"
                className="ui-input"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Passwort</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="ui-input"
                  style={{ ...inputStyle, paddingRight: '38px' }}
                />
                <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(s => !s)} />
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', color: passwordTooShort ? 'var(--accent2)' : 'var(--muted)' }}>
                Mindestens {MIN_PASSWORD_LENGTH} Zeichen
              </div>
            </div>

            <div>
              <label style={labelStyle}>Passwort bestätigen</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="ui-input"
                style={{
                  ...inputStyle,
                  borderColor: passwordsMismatch ? 'var(--accent2)' : 'var(--border)',
                }}
              />
              {passwordsMismatch && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent2)' }}>
                  Die Passwörter stimmen nicht überein.
                </div>
              )}
            </div>

            {error && (
              <div style={{ fontSize: '12px', color: 'var(--accent2)', padding: '10px 14px', background: '#fff0f2', border: '1px solid #ffd0d8', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || passwordsMismatch}
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
                cursor: loading || passwordsMismatch ? 'not-allowed' : 'pointer',
                opacity: loading || passwordsMismatch ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Konto wird erstellt…' : 'Konto erstellen'}
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
