import type { MetadataRoute } from 'next'

// Wiki ist fuer Freunde gedacht, nicht fuer die oeffentliche Google-Suche —
// Crawler komplett aussperren statt eine Sitemap fuer Discovery anzubieten.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
