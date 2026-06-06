'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/db/client'
import { ensureProfile } from '@/lib/profile'
import { getSessionUser, requireOrgAction, requireProjectAction } from '@/lib/auth/permissions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------------
// Project state types
// ---------------------------------------------------------------------------

export type ProjectActionState = {
  error?: string
  fieldErrors?: Record<string, string>
} | null

export type FlagActionState = {
  error?: string
  fieldErrors?: Record<string, string>
} | null

export type EnvActionState = {
  error?: string
} | null

export type ApiKeyActionState = {
  error?: string
  rawKey?: string
  keyId?: string
} | null

export type MemberActionState = {
  error?: string
  success?: boolean
} | null

export type FlagStateActionState = {
  error?: string
  success?: boolean
} | null

// ---------------------------------------------------------------------------
// createProject
// Bootstrap path: any signed-in user can create a project. They become OWNER
// of the auto-created org. No membership check possible (the org doesn't
// exist yet).
// ---------------------------------------------------------------------------

export async function createProject(
  _state: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await getSessionUser()

  // Ensure a Profile row exists — the auth.users→profiles trigger runs
  // independently, but this makes the flow reliable regardless of timing.
  await ensureProfile({ id: user.id, email: user.email })

  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null

  if (!name) return { error: 'Project name is required' }
  if (name.length > 80) return { error: 'Name must be 80 characters or fewer' }

  const projectSlug = toSlug(name)
  const orgSlug = `${projectSlug}-${crypto.randomBytes(4).toString('hex')}`

  // Create organisation
  const org = await prisma.organization.create({
    data: { name, slug: orgSlug },
  })

  // Add creator as OWNER
  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      role: 'OWNER',
    },
  })

  // Create project (allow duplicate slugs across orgs via composite unique)
  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name,
      slug: projectSlug,
      description,
    },
  })

  // Create 3 default environments
  const defaultEnvs = [
    { name: 'Production', slug: 'production', color: '#22c55e', sortOrder: 0 },
    { name: 'Staging', slug: 'staging', color: '#f59e0b', sortOrder: 1 },
    { name: 'Development', slug: 'development', color: '#6366f1', sortOrder: 2 },
  ]

  for (const env of defaultEnvs) {
    await prisma.environment.create({
      data: { projectId: project.id, ...env },
    })
  }

  redirect(`/projects/${project.id}`)
}

// ---------------------------------------------------------------------------
// createFlag — DEVELOPER+ on the project's org
// ---------------------------------------------------------------------------

export async function createFlag(
  projectId: string,
  _state: FlagActionState,
  formData: FormData,
): Promise<FlagActionState> {
  await requireProjectAction(projectId, 'flag.write')

  const key = (formData.get('key') as string | null)?.trim()
  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const type = (formData.get('type') as string | null) ?? 'BOOLEAN'

  if (!key) return { fieldErrors: { key: 'Key is required' } }
  if (!name) return { fieldErrors: { name: 'Name is required' } }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(key)) {
    return {
      fieldErrors: {
        key: 'Key must be lowercase, start and end with a letter or number, and may contain hyphens',
      },
    }
  }

  const validTypes = ['BOOLEAN', 'STRING', 'NUMBER', 'JSON']
  if (!validTypes.includes(type)) return { error: 'Invalid flag type' }

  const existing = await prisma.flag.findUnique({
    where: { projectId_key: { projectId, key } },
  })
  if (existing) return { fieldErrors: { key: 'A flag with this key already exists' } }

  const flag = await prisma.flag.create({
    data: {
      projectId,
      key,
      name,
      description,
      type: type as 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON',
    },
  })

  const environments = await prisma.environment.findMany({
    where: { projectId },
    select: { id: true },
  })

  if (environments.length > 0) {
    await prisma.flagState.createMany({
      data: environments.map((env) => ({
        flagId: flag.id,
        environmentId: env.id,
        enabled: false,
        rolloutPct: 100,
      })),
    })
  }

  redirect(`/projects/${projectId}`)
}

// ---------------------------------------------------------------------------
// updateFlagState — DEVELOPER+ on the project's org
// Programmatic update (called from client components like FlagToggle)
// ---------------------------------------------------------------------------

export async function updateFlagState(
  flagId: string,
  envId: string,
  data: { enabled?: boolean; rolloutPct?: number },
  projectId: string,
): Promise<void> {
  await requireProjectAction(projectId, 'flag.write')

  await prisma.flagState.updateMany({
    where: { flagId, environmentId: envId },
    data: {
      ...data,
      version: { increment: 1 },
    },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/flags/${flagId}`)
}

// ---------------------------------------------------------------------------
// saveFlagState — DEVELOPER+ on the project's org
// Form-based update from the flag detail page
// ---------------------------------------------------------------------------

export async function saveFlagState(
  projectId: string,
  _state: FlagStateActionState,
  formData: FormData,
): Promise<FlagStateActionState> {
  await requireProjectAction(projectId, 'flag.write')

  const flagId = formData.get('flagId') as string
  const envId = formData.get('envId') as string
  const enabled = formData.get('enabled') === '1'
  const rolloutPct = Math.min(100, Math.max(0, parseInt((formData.get('rolloutPct') as string) ?? '100', 10)))

  if (!flagId || !envId) return { error: 'Missing flagId or envId' }

  await prisma.flagState.updateMany({
    where: { flagId, environmentId: envId },
    data: { enabled, rolloutPct, version: { increment: 1 } },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/flags/${flagId}`)

  return { success: true }
}

// ---------------------------------------------------------------------------
// archiveFlag — DEVELOPER+ on the project's org
// ---------------------------------------------------------------------------

export async function archiveFlag(flagId: string, archived: boolean, projectId: string): Promise<void> {
  await requireProjectAction(projectId, 'flag.write')

  await prisma.flag.update({
    where: { id: flagId },
    data: { archived },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/flags/${flagId}`)
}

// ---------------------------------------------------------------------------
// createEnvironment — DEVELOPER+ on the project's org
// ---------------------------------------------------------------------------

export async function createEnvironment(
  projectId: string,
  _state: EnvActionState,
  formData: FormData,
): Promise<EnvActionState> {
  await requireProjectAction(projectId, 'environment.write')

  const name = (formData.get('name') as string | null)?.trim()
  const slug = (formData.get('slug') as string | null)?.trim()
  const color = (formData.get('color') as string | null)?.trim() || '#6366f1'

  if (!name) return { error: 'Environment name is required' }
  if (!slug) return { error: 'Slug is required' }
  if (!/^[a-z0-9-]+$/.test(slug)) return { error: 'Slug must be lowercase letters, numbers, and hyphens only' }

  const existing = await prisma.environment.findUnique({
    where: { projectId_slug: { projectId, slug } },
  })
  if (existing) return { error: 'An environment with this slug already exists' }

  const count = await prisma.environment.count({ where: { projectId } })

  const env = await prisma.environment.create({
    data: { projectId, name, slug, color, sortOrder: count },
  })

  const flags = await prisma.flag.findMany({
    where: { projectId },
    select: { id: true },
  })

  if (flags.length > 0) {
    await prisma.flagState.createMany({
      data: flags.map((flag) => ({
        flagId: flag.id,
        environmentId: env.id,
        enabled: false,
        rolloutPct: 100,
      })),
    })
  }

  revalidatePath(`/projects/${projectId}/environments`)
  return null
}

// ---------------------------------------------------------------------------
// deleteEnvironment — DEVELOPER+ on the project's org
// ---------------------------------------------------------------------------

export async function deleteEnvironment(envId: string, projectId: string): Promise<void> {
  await requireProjectAction(projectId, 'environment.write')
  await prisma.environment.delete({ where: { id: envId } })
  revalidatePath(`/projects/${projectId}/environments`)
}

// ---------------------------------------------------------------------------
// createApiKey — DEVELOPER+ on the project's org
// Generates key, stores hash, returns raw key once
// ---------------------------------------------------------------------------

export async function createApiKey(
  projectId: string,
  _state: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  await requireProjectAction(projectId, 'apikey.write')

  const name = (formData.get('name') as string | null)?.trim()
  const environmentId = formData.get('environmentId') as string | null
  const type = (formData.get('type') as string | null) ?? 'SDK'

  if (!name) return { error: 'Name is required' }
  if (!environmentId) return { error: 'Environment is required' }

  const validTypes = ['SDK', 'SERVER']
  if (!validTypes.includes(type)) return { error: 'Invalid key type' }

  const prefix = type === 'SDK' ? 'sdk' : 'srv'
  const rawKey = `lw_${prefix}_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.substring(0, 12)

  const apiKey = await prisma.apiKey.create({
    data: {
      environmentId,
      name,
      keyHash,
      keyPrefix,
      type: type as 'SDK' | 'SERVER',
    },
  })

  revalidatePath(`/projects/${projectId}/api-keys`)

  return { rawKey, keyId: apiKey.id }
}

// ---------------------------------------------------------------------------
// revokeApiKey — DEVELOPER+ on the project's org
// ---------------------------------------------------------------------------

export async function revokeApiKey(keyId: string, projectId: string): Promise<void> {
  await requireProjectAction(projectId, 'apikey.write')

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  })

  revalidatePath(`/projects/${projectId}/api-keys`)
}

// ---------------------------------------------------------------------------
// inviteMember — ADMIN+ on the org (legacy direct-add; superseded by invites.ts)
// Kept for backward compatibility with any current callers.
// ---------------------------------------------------------------------------

export async function inviteMember(
  organizationId: string,
  projectId: string,
  _state: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  await requireOrgAction(organizationId, 'member.write')

  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const role = (formData.get('role') as string | null) ?? 'VIEWER'

  if (!email) return { error: 'Email is required' }

  const validRoles = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']
  if (!validRoles.includes(role)) return { error: 'Invalid role' }

  const profile = await prisma.profile.findUnique({ where: { email } })
  if (!profile) {
    return { error: 'No registered user found with that email address' }
  }

  const existing = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: profile.id } },
  })
  if (existing) {
    return { error: 'This user is already a member of the organization' }
  }

  await prisma.organizationMember.create({
    data: {
      organizationId,
      userId: profile.id,
      role: role as 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER',
    },
  })

  revalidatePath(`/projects/${projectId}/members`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateMemberRole — ADMIN+ on the org
// ---------------------------------------------------------------------------

export async function updateMemberRole(
  memberId: string,
  role: string,
  projectId: string,
): Promise<void> {
  const validRoles = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  const member = await prisma.organizationMember.findUnique({
    where: { id: memberId },
    select: { organizationId: true, role: true },
  })
  if (!member) throw new Error('Member not found')

  await requireOrgAction(member.organizationId, 'member.write')

  // Guard: don't allow removing the last OWNER.
  if (member.role === 'OWNER' && role !== 'OWNER') {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: member.organizationId, role: 'OWNER' },
    })
    if (ownerCount <= 1) {
      throw new Error('Cannot demote the last owner of an organization')
    }
  }

  await prisma.organizationMember.update({
    where: { id: memberId },
    data: { role: role as 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER' },
  })

  revalidatePath(`/projects/${projectId}/members`)
}

// ---------------------------------------------------------------------------
// removeMember — ADMIN+ on the org
// ---------------------------------------------------------------------------

export async function removeMember(memberId: string, projectId: string): Promise<void> {
  const member = await prisma.organizationMember.findUnique({
    where: { id: memberId },
    select: { organizationId: true, role: true },
  })
  if (!member) throw new Error('Member not found')

  await requireOrgAction(member.organizationId, 'member.write')

  // Guard: don't allow removing the last OWNER.
  if (member.role === 'OWNER') {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: member.organizationId, role: 'OWNER' },
    })
    if (ownerCount <= 1) {
      throw new Error('Cannot remove the last owner of an organization')
    }
  }

  await prisma.organizationMember.delete({ where: { id: memberId } })
  revalidatePath(`/projects/${projectId}/members`)
}
