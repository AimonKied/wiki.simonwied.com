'use client'

import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem('wiki-theme', theme)
  } catch {}
  window.dispatchEvent(new CustomEvent('wiki-theme-change', { detail: { theme } }))
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readTheme,
    () => 'light',
  )

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(nextTheme)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Lightmode' : 'Darkmode'}
      aria-label={theme === 'dark' ? 'Lightmode aktivieren' : 'Darkmode aktivieren'}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener('wiki-theme-change', onChange)
  return () => window.removeEventListener('wiki-theme-change', onChange)
}
