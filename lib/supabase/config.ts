const MISSING_ENV_MESSAGE =
  'Supabase ist nicht konfiguriert. Setze NEXT_PUBLIC_SUPABASE_URL und ' +
  'NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local und starte den Dev-Server neu.'

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(MISSING_ENV_MESSAGE)
  }

  return { url, anonKey }
}
