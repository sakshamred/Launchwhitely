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
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-lg">
          <Flag className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-zinc-100 font-semibold">Launchwhitly</h1>
          <p className="text-zinc-500 text-xs">
            {mode === 'login' ? 'Sign in to the control plane' : 'Create your account'}
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
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
