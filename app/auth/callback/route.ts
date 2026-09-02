import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Ziel des Bestaetigungslinks aus der Supabase-Mail. Unterstuetzt beide
// Template-Varianten: PKCE (?code=...) und token_hash (?token_hash=...&type=...).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const nextUrl = safeRedirectUrl(searchParams.get('next'), origin)

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirectOwnerOrSignOut(supabase, nextUrl, origin)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return redirectOwnerOrSignOut(supabase, nextUrl, origin)
  }

  return NextResponse.redirect(new URL('/login?error=confirmation', origin))
}

function safeRedirectUrl(next: string | null, origin: string) {
  try {
    const candidate = new URL(next ?? '/dashboard', origin)
    if (candidate.origin === origin) return candidate
  } catch {}

  return new URL('/dashboard', origin)
}

async function redirectOwnerOrSignOut(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nextUrl: URL,
  origin: string,
) {
  const { data: isOwner, error } = await supabase.rpc('is_wiki_owner')
  if (!error && isOwner === true) return NextResponse.redirect(nextUrl)

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login?error=forbidden', origin))
}
