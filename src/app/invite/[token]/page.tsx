import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/client'
import { acceptInvite } from '@/app/actions/invites'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Flag } from 'lucide-react'

type Props = {
  params: Promise<{ token: string }>
}

export const metadata = {
  title: 'Invitation · Launchwhitly',
}

const roleBadgeVariant = {
  OWNER: 'indigo',
  ADMIN: 'warning',
  DEVELOPER: 'success',
  VIEWER: 'default',
} as const

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
    return (
      <InviteError message="This invite has expired. Ask the person who sent it to send a new one." />
    )
  }

  const expiresIn = Math.ceil((invite.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const role = invite.role as keyof typeof roleBadgeVariant
  const inviterName = invite.invitedBy.name ?? invite.invitedBy.email

  // If not signed in: prompt to sign in first, with ?next= so they come back here.
  if (!user) {
    const next = `/invite/${token}`
    return (
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-lg">
            <Flag className="h-4 w-4 text-white" />
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
            <Badge variant={roleBadgeVariant[role]}>{role}</Badge>.
          </p>
          <p className="text-sm text-zinc-400 mb-6">
            Sign in with Google to accept. The invite expires in {expiresIn} day
            {expiresIn === 1 ? '' : 's'}.
          </p>
          <div className="space-y-2">
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="block">
              <Button className="w-full">Sign in with Google</Button>
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="block text-center text-xs text-zinc-500 hover:text-zinc-300 py-2"
            >
              Create a new account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Signed in: confirm + accept
  const accept = async () => {
    'use server'
    await acceptInvite(token, null, new FormData())
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-lg">
          <Flag className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-zinc-100 font-semibold">Join {invite.organization.name}</h1>
          <p className="text-zinc-500 text-xs">on Launchwhitly</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-sm text-zinc-300 mb-4">
          <span className="text-zinc-100 font-medium">{inviterName}</span> has invited you to
          join as <Badge variant={roleBadgeVariant[role]}>{role}</Badge>.
        </p>
        <p className="text-sm text-zinc-400 mb-6">
          You&apos;re signed in as {user.email}. Accepting will add you to the organization.
        </p>
        <form action={accept}>
          <Button type="submit" className="w-full">
            Accept invitation
          </Button>
        </form>
      </div>
    </div>
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
