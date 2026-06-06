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

  const roleClasses: Record<string, string> = {
    OWNER: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    ADMIN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DEVELOPER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    VIEWER: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  }

  if (!user) {
    const next = `/invite/${token}`
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
            <h1 className="text-zinc-100 font-semibold text-lg">You&apos;re invited</h1>
            <p className="text-zinc-500 text-xs">to {invite.organization.name}</p>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-8">
          <div className="mb-6">
            <h2 className="text-zinc-100 font-medium text-lg mb-1">Accept invitation</h2>
            <p className="text-zinc-500 text-sm">
              <span className="text-zinc-200">{inviterName}</span> invited{' '}
              <span className="text-zinc-200">{invite.email}</span> to join as{' '}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${roleClasses[role] ?? roleClasses.VIEWER}`}>
                {role}
              </span>.
            </p>
          </div>
          <p className="text-zinc-600 text-xs mb-6">
            The invite expires in {expiresIn} day{expiresIn === 1 ? '' : 's'}.
          </p>
          <form action={signInWithGoogle.bind(null, next)}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-zinc-100 text-zinc-900 px-4 h-10 text-sm font-medium hover:bg-white transition-colors"
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
    )
  }

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
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-8">
        <h1 className="text-zinc-100 font-medium text-lg mb-2">Invalid invite</h1>
        <p className="text-sm text-zinc-500">{message}</p>
        <Link
          href="/login"
          className="block mt-6 text-center text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  )
}