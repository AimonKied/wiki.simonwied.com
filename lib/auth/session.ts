import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

interface OwnerSession {
  user: User | null
  isOwner: boolean
}

export const getOwnerSession = cache(async (): Promise<OwnerSession> => {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user) return { user: null, isOwner: false }
  if (userError) throw new Error(`Session konnte nicht geprüft werden: ${userError.message}`)

  const { data: isOwner, error: ownerError } = await supabase.rpc('is_wiki_owner')
  if (ownerError) throw new Error(`Wiki-Eigentümer konnte nicht geprüft werden: ${ownerError.message}`)

  return { user, isOwner: isOwner === true }
})
