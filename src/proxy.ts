import type { NextRequest } from 'next/server'
import { refreshSession } from '@/lib/supabase/proxy'

// Next.js 16 renamed `middleware` to `proxy`. This file is the entrypoint
// for every request. The actual session-refresh + redirect logic lives in
// `lib/supabase/proxy.ts` so it can be unit-tested independently.
export async function proxy(request: NextRequest) {
  return refreshSession(request)
}

export const config = {
  matcher: [
    // Run on every path except Next internals, static assets, and the auth
    // callback (which must read the OAuth code without interference from
    // the auth-based redirects inside refreshSession).
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
