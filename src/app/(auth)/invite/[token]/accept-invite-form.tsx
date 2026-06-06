'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { acceptInvite, type AcceptInviteState } from '@/app/actions/invites'

type Props = {
  token: string
  inviterName: string
  orgName: string
  roleLabel: string
  email: string
}

const initialState: AcceptInviteState = null

export function AcceptInviteForm({ token, inviterName, orgName, roleLabel, email }: Props) {
  const [state, formAction, isPending] = useActionState(
    acceptInvite.bind(null, token),
    initialState,
  )

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" x2="4" y1="22" y2="15" />
          </svg>
        </div>
        <div>
          <h1 className="text-zinc-100 font-semibold">Join {orgName}</h1>
          <p className="text-zinc-500 text-xs">on Launchwhitly</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-sm text-zinc-300 mb-4">
          <span className="text-zinc-100 font-medium">{inviterName}</span> has invited you to
          join as <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{roleLabel}</span>.
        </p>
        <p className="text-sm text-zinc-400 mb-6">
          You&apos;re signed in as <span className="text-zinc-100">{email}</span>.
          Accepting will add you to the organization.
        </p>

        {state?.error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{state.error}</p>
          </div>
        )}

        <form action={formAction}>
          <Button type="submit" className="w-full" loading={isPending}>
            Accept invitation
          </Button>
        </form>
      </div>
    </div>
  )
}