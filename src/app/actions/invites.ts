'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/db/client'
import { ensureProfile } from '@/lib/profile'
import { getSessionUser, requireOrgAction } from '@/lib/auth/permissions'
import { ROLES, type Role } from '@/lib/auth/permissions'

const INVITE_TTL_DAYS = 7
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000

export type CreateInviteState = {
  error?: string
  // On success: the URL the inviter should share, plus the invite id.
  invite?: {
    id: string
    url: string
    email: string
    role: Role
    expiresAt: string
  }
} | null

function originFromRequest(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function createInvite(
  organizationId: string,
  projectId: string,
  _state: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const { userId } = await requireOrgAction(organizationId, 'member.write')

  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const role = ((formData.get('role') as string | null) ?? 'DEVELOPER') as Role

  if (!email) return { error: 'Email is required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address' }
  if (!ROLES.includes(role)) return { error: 'Invalid role' }

  // If the email already has a profile and is already a member, refuse.
  const profile = await prisma.profile.findUnique({ where: { email } })
  if (profile) {
    const existingMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: profile.id } },
    })
    if (existingMembership) {
      return { error: 'This user is already a member of the organization' }
    }
  }

  // If there's an unexpired, unrevoked, unaccepted invite for the same
  // (org, email) — just return the existing URL instead of creating a new one.
  const existing = await prisma.invite.findFirst({
    where: {
      organizationId,
      email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (existing) {
    return {
      invite: {
        id: existing.id,
        email: existing.email,
        role: existing.role as Role,
        expiresAt: existing.expiresAt.toISOString(),
        url: `${originFromRequest()}/invite/${existing.token}`,
      },
    }
  }

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const invite = await prisma.invite.create({
    data: {
      organizationId,
      email,
      role,
      token,
      invitedById: userId,
      expiresAt,
    },
  })

  revalidatePath(`/projects/${projectId}/members`)

  return {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role as Role,
      expiresAt: invite.expiresAt.toISOString(),
      url: `${originFromRequest()}/invite/${invite.token}`,
    },
  }
}

export async function revokeInvite(
  inviteId: string,
  projectId: string,
): Promise<void> {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { organizationId: true },
  })
  if (!invite) return

  await requireOrgAction(invite.organizationId, 'member.write')

  await prisma.invite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  })

  revalidatePath(`/projects/${projectId}/members`)
}

export type AcceptInviteState = {
  error?: string
} | null

export async function acceptInvite(
  token: string,
  _state: AcceptInviteState,
  _formData: FormData,
): Promise<AcceptInviteState> {
  const user = await getSessionUser()

  // Ensure a Profile row exists — the trigger may not have fired yet.
  await ensureProfile({ id: user.id, email: user.email })

  const invite = await prisma.invite.findUnique({ where: { token } })
  if (!invite) return { error: 'This invite is invalid or has been removed.' }
  if (invite.revokedAt) return { error: 'This invite has been revoked.' }
  if (invite.acceptedAt) return { error: 'This invite has already been accepted.' }
  if (invite.expiresAt < new Date()) {
    return { error: 'This invite has expired. Ask the person who sent it to send a new one.' }
  }

  // Soft check: invite email should match signed-in user email. This stops a
  // signed-in user from "stealing" someone else's invite link. If Google
  // returns a different email than the invite, refuse and tell them.
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { email: true },
  })
  if (profile?.email && profile.email.toLowerCase() !== invite.email.toLowerCase()) {
    return {
      error: `This invite was sent to ${invite.email}. You are signed in as ${profile.email}. Sign out and sign in with the invited account.`,
    }
  }

  // Already a member? (E.g. invite was created then user was added directly.)
  const existing = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
  })
  if (existing) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
    redirect('/projects')
  }

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        organizationId: invite.organizationId,
        userId: user.id,
        role: invite.role,
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ])

  redirect('/projects')
}
