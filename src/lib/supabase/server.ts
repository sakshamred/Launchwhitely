import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from './env'

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const { url, key } = getSupabaseEnv()

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is handling session refresh.
          }
        },
      },
    },
  )
}
