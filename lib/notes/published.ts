import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/auth/session'
import type { Category, PublishedNoteResult } from './types'

export interface PublicNoteSummary {
  id: string
  title: string
  emoji: string | null
  description: string | null
  slug: string | null
  updatedAt: string
  categories: Category[]
}

export const getPublicNote = cache(async (slug: string): Promise<PublishedNoteResult | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('get_public_note', { p_slug: slug })
    .maybeSingle()

  if (error) throw new Error(`Öffentliche Notiz konnte nicht geladen werden: ${error.message}`)
  return data as PublishedNoteResult | null
})

export const getSharedNote = cache(async (token: string): Promise<PublishedNoteResult | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('get_shared_note', { p_token: token })
    .maybeSingle()

  if (error) throw new Error(`Geteilte Notiz konnte nicht geladen werden: ${error.message}`)
  return data as PublishedNoteResult | null
})

export async function listPublicNotes(): Promise<PublicNoteSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_public_notes')
  if (error) throw new Error(`Öffentliche Notizen konnten nicht geladen werden: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const published = (row.published ?? null) as {
      title?: string
      emoji?: string | null
      description?: string | null
      slug?: string | null
    } | null

    return {
      id: row.note_id as string,
      title: published?.title ?? (row.title as string),
      emoji: published?.emoji ?? (row.emoji as string | null),
      description: published?.description ?? (row.description as string | null),
      slug: published?.slug ?? (row.slug as string | null),
      updatedAt: row.updated_at as string,
      categories: (row.categories as Category[] | null) ?? [],
    }
  })
}

export interface Backlink {
  id: string
  title: string
  emoji: string | null
  slug: string
}

// "Verlinkt von": welche anderen oeffentlichen Artikel zeigen hierher?
//
// Die [[-Verweise stehen als gewoehnliche Link-Marken im Inhalt, das Ziel ist
// immer /notes/<slug>. Gesucht wird auf dem JSON-Text statt ueber einen Walk
// durch den Baum -- der Href taucht dort woertlich auf, und die Anfuehrungs-
// zeichen aus JSON.stringify machen den Treffer exakt: "/notes/git" passt
// nicht mehr auf "/notes/git-commands".
//
// Ohne eigene Abfrage: list_public_notes liefert die Snapshots samt Inhalt
// ohnehin schon. Bei wachsendem Bestand waere das der Punkt, an dem sich eine
// eigene RPC mit Volltextsuche lohnt.
export async function listBacklinks(slug: string): Promise<Backlink[]> {
  if (!slug) return []
  const notes = await listPublicNotesRaw()
  const needle = JSON.stringify(`/notes/${slug}`)

  return notes
    .filter(note => note.slug && note.slug !== slug && note.contentJson.includes(needle))
    .map(note => ({
      id: note.id,
      title: note.title,
      emoji: note.emoji,
      slug: note.slug as string,
    }))
}

interface RawPublicNote {
  id: string
  title: string
  emoji: string | null
  slug: string | null
  contentJson: string
}

const listPublicNotesRaw = cache(async (): Promise<RawPublicNote[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_public_notes')
  if (error) throw new Error(`Öffentliche Notizen konnten nicht geladen werden: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const published = (row.published ?? {}) as {
      title?: string
      emoji?: string | null
      slug?: string | null
      content?: object | null
    }
    return {
      id: row.note_id as string,
      title: published.title ?? 'Ohne Titel',
      emoji: published.emoji ?? null,
      slug: published.slug ?? null,
      contentJson: published.content ? JSON.stringify(published.content) : '',
    }
  })
})

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('position')
    .order('title')

  if (error) throw new Error(`Kategorien konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as Category[]
}

export async function recordOwnerVisit(note: PublishedNoteResult): Promise<boolean> {
  const { user, isOwner } = await getOwnerSession()
  const ownsNote = isOwner && user?.id === note.user_id
  if (!ownsNote) return false

  const supabase = await createClient()
  const { error } = await supabase
    .from('notes')
    .update({ last_opened_at: new Date().toISOString() })
    .eq('id', note.note_id)

  if (error) console.error('last_opened_at konnte nicht gesetzt werden:', error.message)
  return true
}
