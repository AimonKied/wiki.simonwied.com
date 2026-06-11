export interface Note {
  id: string
  user_id: string
  title: string
  content: object | null
  slug: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}
