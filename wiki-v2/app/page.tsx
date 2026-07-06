import Link from 'next/link'
import ThemeToggle from '@/components/theme/ThemeToggle'

// Beta-Landing-Page auf / — die Bibliothek (frueher hier) lebt unter
// /bibliothek. Ersetzt die statische Teaser-Seite aus dem Repo-Root:
// ein Deploy serviert Landing UND Wiki auf wiki.simonwied.com.
export default function LandingPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 1,
      padding: '60px 20px',
    }}>
      <div style={{ position: 'fixed', top: '16px', right: '16px' }}>
        <ThemeToggle />
      </div>

      <div style={{ width: 'min(540px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--accent)', marginBottom: '20px', fontWeight: 700,
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--accent)', animation: 'pulse 2s ease-in-out infinite',
          }} />
          Beta im Aufbau
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 7vw, 52px)', fontWeight: 800, lineHeight: 1.05,
          letterSpacing: '-0.02em', marginBottom: '20px', fontFamily: 'var(--font-display)',
        }}>
          Wird gerade neu gebaut.
        </h1>

        <p style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--muted)', marginBottom: '40px' }}>
          Die Wiki bekommt ein neues Fundament. Früher kamen neue Seiten per Pull Request,
          jetzt kann man Inhalte direkt auf der Webseite erstellen und verwalten.
        </p>

        <ul style={{
          listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px',
          marginBottom: '16px', padding: '24px', border: '1px solid var(--border)',
          borderRadius: '12px', background: 'var(--surface)', width: '100%',
        }}>
          {[
            'Inhalte direkt im Browser anlegen, statt über Pull Requests',
            'Artikel schreiben, speichern und veröffentlichen ohne Git-Workflow',
            'Inhalte privat halten oder als öffentliche Wiki-Seite freigeben',
          ].map(line => (
            <li key={line} style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
              {line}
            </li>
          ))}
        </ul>

        <div style={{
          width: '100%', border: '1px solid var(--border)', borderRadius: '12px',
          background: 'var(--surface)', padding: '20px 24px 0', marginBottom: '48px', overflow: 'hidden',
        }}>
          <p style={{
            fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--accent)', marginBottom: '10px', fontWeight: 700,
          }}>
            Neu: Canvas-Modus
          </p>
          <p style={{ fontSize: '13px', lineHeight: 1.8, color: 'var(--muted)', marginBottom: '20px' }}>
            Kein lineares Scrollen — Inhalte frei auf einer Fläche anordnen.
            Blöcke verschieben, zoomen, verknüpfen. Gut für Mindmaps,
            Projektübersichten oder alles, was nicht in einen Artikel passt.
          </p>
          <div aria-hidden="true" style={{
            position: 'relative', height: '120px', borderTop: '1px solid var(--border)',
            backgroundImage: [
              'linear-gradient(var(--grid-line) 1px, transparent 1px)',
              'linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '24px 24px', margin: '0 -24px',
          }}>
            <span style={{ position: 'absolute', top: '16px', left: '18px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Notiz A</span>
            <span style={{ position: 'absolute', top: '48px', right: '22px', padding: '8px 12px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)', fontSize: '11px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>Idee B</span>
            <span style={{ position: 'absolute', bottom: '14px', left: '38%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', opacity: 0.5 }}>Referenz C</span>
          </div>
        </div>

        <Link href="/bibliothek" style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          marginBottom: '18px', padding: '13px 24px',
          background: 'var(--accent)', borderRadius: '10px',
          color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
        }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '3px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.22)',
          }}>
            Beta
          </span>
          Die neue Wiki ausprobieren
          <span aria-hidden="true">→</span>
        </Link>

        <Link href="/login" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>
          Schon dabei? Anmelden →
        </Link>

      </div>
    </main>
  )
}
