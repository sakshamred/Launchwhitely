import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/client'
import { AcceptInviteForm } from './accept-invite-form'
import { signInWithGoogle } from '@/app/actions/auth'

export const metadata = {
  title: 'Invitation · Launchwhitly',
}

const roleBadgeVariant = {
  OWNER: 'indigo',
  ADMIN: 'warning',
  DEVELOPER: 'success',
  VIEWER: 'default',
} as const

type Props = {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params

  // Bounce already-signed-in users from landing on /invite if they somehow
  // get redirected here by proxy while being authenticated.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  })

  if (!invite || invite.revokedAt) {
    return <InviteError message="This invite is invalid or has been removed." />
  }
  if (invite.acceptedAt) {
    return <InviteError message="This invite has already been accepted." />
  }
  if (invite.expiresAt < new Date()) {
    return <InviteError message="This invite has expired. Ask the person who sent it to send a new one." />
  }

  const expiresIn = Math.ceil((invite.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const role = invite.role as keyof typeof roleBadgeVariant
  const inviterName = invite.invitedBy.name ?? invite.invitedBy.email

  // Not signed in: prompt to sign in first, with ?next= so they come back.
  if (!user) {
    const next = `/invite/${token}`
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
            <h1 className="text-zinc-100 font-semibold">You&apos;re invited</h1>
            <p className="text-zinc-500 text-xs">to {invite.organization.name}</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-300 mb-4">
            <span className="text-zinc-100 font-medium">{inviterName}</span> invited{' '}
            <span className="text-zinc-100 font-medium">{invite.email}</span> to join as{' '}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
              roleBadgeVariant[role] === 'indigo' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
              roleBadgeVariant[role] === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              roleBadgeVariant[role] === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
            }`}>
              {role}
            </span>.
          </p>
          <p className="text-sm text-zinc-400 mb-6">
            Sign in with Google to accept. The invite expires in {expiresIn} day
            {expiresIn === 1 ? '' : 's'}.
          </p>
          <div className="space-y-2">
            <form action={signInWithGoogle.bind(null, next)}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Signed in: show accept form with error handling.
  return (
    <AcceptInviteForm
      token={token}
      inviterName={inviterName}
      orgName={invite.organization.name}
      roleLabel={role}
      email={user.email ?? 'unknown'}
    />
  )
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="w-full max-w-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h1 className="text-zinc-100 font-semibold mb-2">Invalid invite</h1>
        <p className="text-sm text-zinc-400">{message}</p>
        <Link
          href="/login"
          className="block mt-6 text-center text-sm text-indigo-400 hover:text-indigo-300"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  )
}