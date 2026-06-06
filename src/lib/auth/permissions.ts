import 'server-only'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { prisma } from '@/db/client'
import { createClient } from '@/lib/supabase/server'

export const ROLES = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'] as const
export type Role = (typeof ROLES)[number]

// Role hierarchy: a higher rank inherits all permissions of lower ranks.
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  DEVELOPER: 1,
  ADMIN: 2,
  OWNER: 3,
}

export type Action =
  | 'project.view'
  | 'flag.write'
  | 'environment.write'
  | 'apikey.write'
  | 'member.write'

// Minimum role required to perform each action.
const ACTION_MIN_ROLE: Record<Action, Role> = {
  'project.view': 'VIEWER',
  'flag.write': 'DEVELOPER',
  'environment.write': 'DEVELOPER',
  'apikey.write': 'DEVELOPER',
  'member.write': 'ADMIN',
}

export function can(role: Role | null, action: Action): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[ACTION_MIN_ROLE[action]]
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export async function getSessionUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

// ---------------------------------------------------------------------------
// Org / project membership
// ---------------------------------------------------------------------------

export async function getOrgRole(organizationId: string): Promise<Role | null> {
  const user = await getSessionUser()
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
    select: { role: true },
  })
  return membership?.role ?? null
}

export async function requireOrgRole(
  organizationId: string,
  allowed: readonly Role[],
): Promise<{ userId: string; role: Role; organizationId: string }> {
  const user = await getSessionUser()
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
    select: { role: true },
  })
  if (!membership || !allowed.includes(membership.role)) {
    throw new Error('Forbidden')
  }
  return { userId: user.id, role: membership.role, organizationId }
}

export async function requireOrgAction(
  organizationId: string,
  action: Action,
): Promise<{ userId: string; role: Role; organizationId: string }> {
  const user = await getSessionUser()
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
    select: { role: true },
  })
  if (!membership || !can(membership.role, action)) {
    throw new Error('Forbidden')
  }
  return { userId: user.id, role: membership.role, organizationId }
}

export async function getProjectOrganizationId(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  })
  if (!project) throw new Error('Project not found')
  return project.organizationId
}

// Project-level check: looks up org, then enforces an action-based permission.
export async function requireProjectAction(
  projectId: string,
  action: Action,
): Promise<{ userId: string; role: Role; organizationId: string }> {
  const organizationId = await getProjectOrganizationId(projectId)
  return requireOrgAction(organizationId, action)
}
