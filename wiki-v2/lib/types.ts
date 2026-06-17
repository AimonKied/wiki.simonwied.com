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
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  slug: string
  title: string
  color: string | null
  created_at: string
}

export interface NoteWithCategories extends Note {
  categories: Category[]
}
