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
  content_type: 'article' | 'workspace'
  slug: string | null
  is_public: boolean
  // Frozen public snapshot; the live columns above are the working draft.
  published?: PublishedSnapshot | null
  created_at: string
  updated_at: string
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
