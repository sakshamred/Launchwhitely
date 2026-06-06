import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './env'

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, key } = getSupabaseEnv()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const isAuthPage =
    request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup'
  const isDashboard =
    request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/projects')

  if (!data?.claims.sub && isDashboard) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (data?.claims.sub && isAuthPage) {
    const redirect = NextResponse.redirect(new URL('/projects', request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}
