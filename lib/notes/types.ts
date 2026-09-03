export interface PublishedSnapshot {
  title: string
  emoji: string | null
  description: string | null
  content: object | null
  slug: string | null
}

export interface Note {
  id: string
  user_id: string
  title: string
  emoji: string | null
  description: string | null
  content: object | null
  slug: string | null
  is_public: boolean
  visibility: 'private' | 'link' | 'public'
  // Frozen public snapshot; the live columns above are the working draft.
  published?: PublishedSnapshot | null
  published_at?: string | null
  created_at: string
  updated_at: string
  // Wann zuletzt im Editor geoeffnet; speist die "Zuletzt"-Liste der Sidebar
  last_opened_at?: string | null
  // Gesetzt = liegt im Papierkorb. Zeilen bleiben erhalten, alle Listen
  // blenden sie aus und die Lesefunktionen liefern sie nicht mehr aus.
  deleted_at?: string | null
  is_favorite?: boolean
  cover_url?: string | null
}

export type NoteSummary = Pick<
  Note,
  'id' | 'title' | 'emoji' | 'slug' | 'is_public' | 'visibility' | 'updated_at' | 'is_favorite'
>

export interface NoteShareLink {
  note_id: string
  token: string
  created_at: string
  updated_at: string
}

export interface PublishedNoteResult {
  note_id: string
  user_id: string
  published: PublishedSnapshot
  updated_at: string
  published_at: string | null
  author_name: string | null
}

// Oeffentlich lesbarer Anzeigename (Spiegel aus auth.users, siehe migration.sql)
export interface Profile {
  id: string
  display_name: string
  updated_at?: string
}

export interface Category {
  id: string
  slug: string
  title: string
  color: string | null
  position?: number
  created_at: string
}

export interface NoteWithCategories extends Note {
  categories: Category[]
}
