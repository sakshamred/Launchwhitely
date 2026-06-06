import { redirect } from 'next/navigation'
import { AuthForm } from '../auth-form'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{ next?: string }>

export const metadata = {
  title: 'Sign in · Launchwhitly',
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams

  // Bounce already-signed-in users to next (or /projects).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/projects'
    redirect(safeNext)
  }

  // Touch env so a missing config shows up at the sign-in page, not deep in
  // the OAuth redirect chain.
  getSupabaseEnv()

  return <AuthForm mode="login" next={next} />
}
