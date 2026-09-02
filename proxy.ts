import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from '@/lib/supabase/config'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { url, anonKey } = getSupabaseConfig()

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  const isProtected = pathname === '/dashboard'
    || pathname.startsWith('/dashboard/')
    || /^\/notes\/[^/]+\/edit(?:\/|$)/.test(pathname)
  const isAuthRoute = pathname === '/login' || pathname === '/register'

  const { data: { user } } = await supabase.auth.getUser()
  let isOwner = false
  if (user && (isProtected || isAuthRoute)) {
    const { data } = await supabase.rpc('is_wiki_owner')
    isOwner = data === true
  }

  if (isProtected && !isOwner) {
    const loginUrl = new URL('/login', request.url)
    if (user) loginUrl.searchParams.set('error', 'forbidden')
    return NextResponse.redirect(loginUrl)
  }
  if (isOwner && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
