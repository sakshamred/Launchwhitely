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
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-8 h-8 bg-zinc-100 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-zinc-900">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" x2="4" y1="22" y2="15" />
          </svg>
        </div>
        <div>
          <h1 className="text-zinc-100 font-semibold text-lg">Join {orgName}</h1>
          <p className="text-zinc-500 text-xs">on Launchwhitly</p>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-8">
        <p className="text-sm text-zinc-300 mb-2">
          <span className="text-zinc-100 font-medium">{inviterName}</span> has invited you to
          join as <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{roleLabel}</span>.
        </p>
        <p className="text-sm text-zinc-500 mb-6">
          You&apos;re signed in as <span className="text-zinc-300">{email}</span>.
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