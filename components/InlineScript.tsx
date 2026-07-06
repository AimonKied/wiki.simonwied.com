'use client'

// React warns in dev when rendering produces a <script> tag, since client
// re-renders (e.g. the notFound() transition) never execute it. type="text/plain"
// on the client neutralizes it there while the server still emits a real
// executable script for the initial HTML parse. Must be a Client Component:
// Server Components never re-run in the browser, so the ternary below would
// always resolve to the server branch and the warning would fire on every
// hydration, not just soft navigations. See:
// node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
