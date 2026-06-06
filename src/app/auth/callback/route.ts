import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles the redirect from Supabase Auth after the user authorises Google.
// Exchanges the `code` for a session, then redirects to `next` (default /projects).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextRaw = searchParams.get('next') ?? '/projects'
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/projects'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    )
  }

  return NextResponse.redirect(new URL('/login?error=missing_code', origin))
}
