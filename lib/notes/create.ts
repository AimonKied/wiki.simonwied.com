import { createClient } from '@/lib/supabase/client'
import { templateByKey } from './templates'

// Creates a private article draft and returns its id — callers navigate straight
// to /notes/[id]/edit; there is no separate create page. Ohne Angabe entsteht
// der leere Artikel, der auch vorher der Standard war.
export async function createNote(templateKey = 'blank'): Promise<string> {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw new Error(`Session konnte nicht geprüft werden: ${userError.message}`)
  if (!user) throw new Error('Du bist nicht mehr angemeldet.')

  const { data: isOwner, error: ownerError } = await supabase.rpc('is_wiki_owner')
  if (ownerError) throw new Error(`Berechtigung konnte nicht geprüft werden: ${ownerError.message}`)
  if (isOwner !== true) throw new Error('Dieses Konto darf keine Inhalte erstellen.')

  const template = templateByKey(templateKey)
  const { data, error } = await supabase
    .from('notes')
    .insert({
      title: '',
      emoji: template.emoji,
      description: null,
      content: template.content,
      user_id: user.id,
      is_public: false,
      visibility: 'private',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Inhalt konnte nicht erstellt werden: ${error.message}`)
  if (!data) throw new Error('Inhalt konnte nicht erstellt werden.')
  // Sidebar "Zuletzt" refetches on this
  document.dispatchEvent(new Event('wiki-notes-changed'))
  return data.id
}
