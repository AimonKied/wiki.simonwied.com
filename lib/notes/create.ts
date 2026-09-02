import { createClient } from '@/lib/supabase/client'

const DEFAULT_WORKSPACE_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Übersicht' }] },
        { type: 'paragraph' },
      ],
    },
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Details' }] },
        { type: 'paragraph' },
      ],
    },
    {
      type: 'section',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notizen' }] },
        { type: 'paragraph' },
      ],
    },
  ],
}

const DEFAULT_ARTICLE_CONTENT = {
  type: 'doc',
  attrs: { wikiMode: 'article' },
  content: [
    {
      type: 'section',
      content: [
        { type: 'paragraph' },
      ],
    },
  ],
}

// Creates a private draft and returns its id — callers navigate straight to
// /notes/[id]/edit; there is no separate create page.
export async function createNote(type: 'article' | 'workspace'): Promise<string> {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw new Error(`Session konnte nicht geprüft werden: ${userError.message}`)
  if (!user) throw new Error('Du bist nicht mehr angemeldet.')

  const { data: isOwner, error: ownerError } = await supabase.rpc('is_wiki_owner')
  if (ownerError) throw new Error(`Berechtigung konnte nicht geprüft werden: ${ownerError.message}`)
  if (isOwner !== true) throw new Error('Dieses Konto darf keine Inhalte erstellen.')

  const { data, error } = await supabase
    .from('notes')
    .insert({
      title: '',
      emoji: null,
      description: null,
      content: type === 'workspace' ? DEFAULT_WORKSPACE_CONTENT : DEFAULT_ARTICLE_CONTENT,
      content_type: type,
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
