'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Flag } from 'lucide-react'
import { signIn, signUp, type AuthActionState } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const action = mode === 'login' ? signIn : signUp
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    action,
    null,
  )

  return (
    <div className="w-full">
      <div className="flex flex-col items-center text-center mb-7">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_0_24px_-4px_rgba(99,102,241,0.7)] mb-4">
          <Flag className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-zinc-50 font-semibold text-xl tracking-tight">Launchwhitly</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {mode === 'login' ? 'Sign in to your control plane' : 'Create your account'}
        </p>
      </div>

      <div className="bg-zinc-900/70 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        {state?.error && <p className="mb-4 text-sm text-red-400">{state.error}</p>}
        {state?.success && <p className="mb-4 text-sm text-green-400">{state.success}</p>}

        <form action={formAction} className="space-y-4">
          <Input name="email" label="Email" type="email" autoComplete="email" required />
          <Input
            name="password"
            label="Password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
          <Button type="submit" loading={pending} className="w-full">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-500">
          {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
          <Link
            href={mode === 'login' ? '/signup' : '/login'}
            className="text-indigo-400 hover:text-indigo-300"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  )
}
