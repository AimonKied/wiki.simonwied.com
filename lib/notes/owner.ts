import { createClient } from '@/lib/supabase/server'
import type { Note, NoteSummary } from './types'

export async function listOwnerNotes(): Promise<Note[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Notizen konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as Note[]
}

export async function listTrashedNotes(): Promise<Note[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw new Error(`Papierkorb konnte nicht geladen werden: ${error.message}`)
  return (data ?? []) as Note[]
}

export async function listRecentOwnerNotes(userId: string): Promise<NoteSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, emoji, visibility, is_public, slug, updated_at, is_favorite')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .not('last_opened_at', 'is', null)
    .order('last_opened_at', { ascending: false })
    .limit(8)

  if (error) throw new Error(`Zuletzt geöffnete Notizen konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as NoteSummary[]
}
