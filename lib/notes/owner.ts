import { createClient } from '@/lib/supabase/server'
import type { Note, NoteSummary } from './types'

export async function listOwnerNotes(): Promise<Note[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Notizen konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as Note[]
}

export async function listRecentOwnerNotes(userId: string): Promise<NoteSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, emoji, content_type, visibility, is_public, slug, updated_at')
    .eq('user_id', userId)
    .not('last_opened_at', 'is', null)
    .order('last_opened_at', { ascending: false })
    .limit(8)

  if (error) throw new Error(`Zuletzt geöffnete Notizen konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as NoteSummary[]
}
