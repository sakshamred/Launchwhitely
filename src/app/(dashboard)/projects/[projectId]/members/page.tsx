import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/client'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateInviteButton } from './create-invite-button'
import { MemberActions } from './member-actions'
import { RevokeInviteButton } from './revoke-invite-button'

type Props = {
  params: Promise<{ projectId: string }>
}

type MemberRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER'

const roleBadgeVariant: Record<MemberRole, 'indigo' | 'warning' | 'success' | 'default'> = {
  OWNER: 'indigo',
  ADMIN: 'warning',
  DEVELOPER: 'success',
  VIEWER: 'default',
}

export default async function MembersPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, name: true },
  })
  if (!project) redirect('/projects')

  const { organizationId } = project

  const currentMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
    select: { role: true },
  })

  const [members, pendingInvites] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invite.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { invitedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const canManage =
    currentMembership?.role === 'OWNER' || currentMembership?.role === 'ADMIN'

  return (
    <div className="flex flex-col">
      <Header
        title="Members"
        actions={
          canManage ? (
            <CreateInviteButton organizationId={organizationId} projectId={projectId} />
          ) : undefined
        }
      />

      <div className="p-6 space-y-8">
        <div>
          <h2 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Active members ({members.length})
          </h2>
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members"
              description="Invite team members to collaborate on this project."
            />
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Member
                    </th>
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Role
                    </th>
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Joined
                    </th>
                    {canManage && (
                      <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {members.map((member) => {
                    const isCurrentUser = member.userId === user.id
                    const role = member.role as MemberRole

                    return (
                      <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-zinc-800/60 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-zinc-400 text-[11px] font-medium">
                                {(member.user.name ?? member.user.email)[0]?.toUpperCase() ?? '?'}
                              </span>
                            </div>
                            <div>
                              {member.user.name && (
                                <p className="text-zinc-100 font-medium text-sm">
                                  {member.user.name}
                                  {isCurrentUser && (
                                    <span className="ml-1.5 text-[11px] text-zinc-600">(you)</span>
                                  )}
                                </p>
                              )}
                              <p
                                className={`text-xs ${member.user.name ? 'text-zinc-600' : 'text-zinc-200 font-medium'}`}
                              >
                                {member.user.email}
                                {!member.user.name && isCurrentUser && (
                                  <span className="ml-1.5 text-zinc-600">(you)</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={roleBadgeVariant[role]}>{role}</Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs">
                          {new Date(member.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            {!isCurrentUser && (
                              <MemberActions
                                memberId={member.id}
                                currentRole={role}
                                projectId={projectId}
                                memberName={member.user.name ?? member.user.email}
                              />
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canManage && pendingInvites.length > 0 && (
          <div>
            <h2 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Pending invites ({pendingInvites.length})
            </h2>
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Role
                    </th>
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Invited by
                    </th>
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {pendingInvites.map((invite) => {
                    const role = invite.role as MemberRole
                    const inviterName = invite.invitedBy.name ?? invite.invitedBy.email
                    const daysLeft = Math.max(
                      0,
                      Math.ceil((invite.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                    )
                    return (
                      <tr key={invite.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-zinc-200">{invite.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={roleBadgeVariant[role]}>{role}</Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs">{inviterName}</td>
                        <td className="px-4 py-3 text-zinc-600 text-xs">
                          {daysLeft === 0 ? 'Today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RevokeInviteButton inviteId={invite.id} projectId={projectId} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}