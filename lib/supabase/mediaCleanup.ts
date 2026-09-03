import { createClient } from './client'

const BUCKET = 'wiki-media'
const MARKER = `/storage/v1/object/public/${BUCKET}/`

// Sammelt die Pfade im eigenen Bucket, auf die ein Text verweist.
//
// Gesucht wird auf dem JSON-Text statt ueber einen Walk durch den Baum: die
// URLs stehen in verschiedenen Knoten (Bild, Video, Cover) und koennten in
// weiteren Knotentypen auftauchen, die es heute noch nicht gibt. Der Marker
// des Buckets grenzt zuverlaessig ab -- fremde Adressen, etwa das Vorschaubild
// einer Bookmark-Karte, gehoeren uns nicht und werden nie angefasst.
export function collectBucketPaths(...sources: (string | object | null | undefined)[]): Set<string> {
  const found = new Set<string>()
  for (const source of sources) {
    if (!source) continue
    const text = typeof source === 'string' ? source : JSON.stringify(source)
    let index = text.indexOf(MARKER)
    while (index !== -1) {
      const rest = text.slice(index + MARKER.length)
      // Bis zum ersten Zeichen, das in einer URL nicht mehr vorkommt.
      const path = rest.split(/["'\\\s?)<>]/)[0]
      if (path) found.add(decodeURIComponent(path))
      index = text.indexOf(MARKER, index + MARKER.length)
    }
  }
  return found
}

// Loescht die Dateien einer endgueltig entfernten Notiz -- aber nur die, auf
// die keine andere Notiz mehr zeigt.
//
// Kopiert man einen Bildblock in einen zweiten Artikel, steht dieselbe URL in
// beiden. Ohne die Gegenprobe wuerde das Loeschen des einen das Bild im
// anderen zerstoeren. Bei wachsendem Bestand waere das der Punkt fuer eine
// Zuordnungstabelle Datei→Notiz; bei der aktuellen Groesse genuegt es, die
// verbleibenden Notizen einmal durchzusehen.
export async function deleteUnreferencedMedia(
  content: object | null,
  coverUrl: string | null,
  publishedSnapshot: object | null,
  keepAwayFromNoteId: string,
): Promise<{ deleted: number; error: string | null }> {
  const candidates = collectBucketPaths(content, coverUrl, publishedSnapshot)
  if (candidates.size === 0) return { deleted: 0, error: null }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('content, cover_url, published')
    .neq('id', keepAwayFromNoteId)

  if (error) {
    // Ohne verlaessliche Gegenprobe wird nichts geloescht: eine Karteileiche
    // ist harmlos, ein zerstoertes Bild in einem anderen Artikel nicht.
    return { deleted: 0, error: `Verwendung konnte nicht geprüft werden: ${error.message}` }
  }

  const stillUsed = collectBucketPaths(
    ...(data ?? []).flatMap((row: Record<string, unknown>) => [
      row.content as object | null,
      row.cover_url as string | null,
      row.published as object | null,
    ]),
  )

  const removable = [...candidates].filter(path => !stillUsed.has(path))
  if (removable.length === 0) return { deleted: 0, error: null }

  const { error: removeError } = await supabase.storage.from(BUCKET).remove(removable)
  if (removeError) return { deleted: 0, error: `Dateien konnten nicht entfernt werden: ${removeError.message}` }
  return { deleted: removable.length, error: null }
}
