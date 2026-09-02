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
  contentType: 'article' | 'workspace'
  updatedAt: string
  categories: Category[]
  author: string | null
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
      contentType: row.content_type as 'article' | 'workspace',
      updatedAt: row.updated_at as string,
      categories: (row.categories as Category[] | null) ?? [],
      author: (row.author_name as string | null) ?? null,
    }
  })
}

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
