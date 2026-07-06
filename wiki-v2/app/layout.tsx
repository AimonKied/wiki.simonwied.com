import type { Metadata } from 'next'
import InlineScript from '@/components/InlineScript'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wiki v2',
  description: 'Persönliches Knowledge Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <InlineScript
          html={`
try {
  var storedTheme = localStorage.getItem('wiki-theme');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = storedTheme || (systemDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
} catch {}
          `.trim()}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
