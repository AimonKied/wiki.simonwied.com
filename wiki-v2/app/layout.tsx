import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wiki v2',
  description: 'Persönliches Knowledge Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
