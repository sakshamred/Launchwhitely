import { redirect } from 'next/navigation'
import { AuthForm } from '../auth-form'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{ next?: string }>

export const metadata = {
  title: 'Create account · Launchwhitly',
}

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/projects'
    redirect(safeNext)
  }

  getSupabaseEnv()

  return <AuthForm mode="signup" next={next} />
}
