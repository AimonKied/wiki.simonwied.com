export interface Note {
  id: string
  user_id: string
  title: string
  emoji: string | null
  description: string | null
  content: object | null
  slug: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}
