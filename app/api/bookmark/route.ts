import { NextResponse, type NextRequest } from 'next/server'
import { getOwnerSession } from '@/lib/auth/session'

// Holt Titel, Beschreibung und Vorschaubild einer fremden Seite fuer die
// Bookmark-Karte.
//
// Nur der Eigentümer darf das ausloesen, und nur beim Einfuegen: das Ergebnis
// landet als Attribut im Dokument. Leser einer veroeffentlichten Seite stossen
// damit nie einen Abruf an -- sonst waere jede oeffentliche Artikelseite ein
// Werkzeug, um beliebige Adressen vom Server aus abzurufen.

const FETCH_TIMEOUT_MS = 6000
const MAX_BYTES = 512 * 1024

// Ein Serverabruf darf nicht ins eigene Netz zeigen. Die Pruefung greift auf
// Hostnamen-Ebene und faengt die offensichtlichen Faelle ab; sie ersetzt keine
// Aufloesung der IP, schliesst aber die Wege, die man versehentlich nimmt.
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host === '0.0.0.0') return true
  if (/^127\./.test(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  if (/^fe80:/i.test(host) || /^fc00:/i.test(host) || /^fd/i.test(host)) return true
  return false
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function metaContent(html: string, ...names: string[]): string | null {
  for (const name of names) {
    // property und name, Reihenfolge der Attribute offen -- deshalb zwei Muster
    // statt eines starren.
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'),
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]?.trim()) return decodeEntities(match[1].trim())
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const { isOwner } = await getOwnerSession()
  if (!isOwner) {
    return NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 403 })
  }

  const raw = request.nextUrl.searchParams.get('url')?.trim()
  if (!raw) return NextResponse.json({ error: 'Keine Adresse angegeben.' }, { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Adresse ist ungültig.' }, { status: 400 })
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Nur http und https werden unterstützt.' }, { status: 400 })
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: 'Diese Adresse ist nicht erlaubt.' }, { status: 400 })
  }

  let html = ''
  try {
    const response = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Ohne User-Agent liefern manche Seiten gar nichts oder eine
        // Sperrseite ohne die Metadaten, auf die es hier ankommt.
        'user-agent': 'Mozilla/5.0 (compatible; WikiBookmarkBot/1.0)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) {
      return NextResponse.json({ error: `Seite antwortete mit ${response.status}.` }, { status: 502 })
    }
    const type = response.headers.get('content-type') ?? ''
    if (!type.includes('html')) {
      return NextResponse.json({ error: 'Die Adresse liefert keine Webseite.' }, { status: 415 })
    }
    // Nur den Anfang lesen: die Metadaten stehen im head, der Rest waere
    // Verschwendung -- und eine sehr grosse Seite soll den Server nicht binden.
    const buffer = await response.arrayBuffer()
    html = new TextDecoder().decode(buffer.slice(0, MAX_BYTES))
  } catch {
    return NextResponse.json({ error: 'Seite konnte nicht geladen werden.' }, { status: 502 })
  }

  const title =
    metaContent(html, 'og:title', 'twitter:title') ??
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
    target.hostname

  const image = metaContent(html, 'og:image', 'twitter:image')
  let absoluteImage: string | null = null
  if (image) {
    try {
      absoluteImage = new URL(image, target).toString()
    } catch {
      absoluteImage = null
    }
  }

  return NextResponse.json({
    url: target.toString(),
    title: decodeEntities(title).slice(0, 200),
    description: metaContent(html, 'og:description', 'twitter:description', 'description')?.slice(0, 300) ?? null,
    image: absoluteImage,
    siteName: metaContent(html, 'og:site_name') ?? target.hostname,
  })
}
