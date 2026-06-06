'use server'

import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/profile'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type AuthActionState = {
  error?: string
  success?: string
} | null

const credentialsSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8),
})

export async function signIn(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Enter a valid email and an 8+ character password.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: error.message }
  await ensureProfile(data.user)

  redirect('/projects')
}

export async function signUp(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Enter a valid email and an 8+ character password.' }
  }

  const origin = (await headers()).get('origin')
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
  })
  if (error) return { error: error.message }
  if (data.user) await ensureProfile(data.user)
  if (data.session) redirect('/projects')

  return { success: 'Check your email to confirm your account.' }
}

export async function signOut(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
