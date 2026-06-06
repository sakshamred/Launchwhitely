import { redirect } from 'next/navigation'
import { prisma } from '@/db/client'
import { createClient } from '@/lib/supabase/server'

export type AppUser = {
  id: string
  email?: string
}

export type ProjectRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER'

const roleLevel: Record<ProjectRole, number> = {
  VIEWER: 1,
  DEVELOPER: 2,
  ADMIN: 3,
  OWNER: 4,
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const id = data?.claims.sub

  if (error || !id) return null

  return {
    id,
    email: typeof data.claims.email === 'string' ? data.claims.email : undefined,
  }
}

export async function requirePageUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function getProjectRole(userId: string, projectId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { projects: { some: { id: projectId } } },
    },
    select: { role: true },
  })

  return membership?.role ?? null
}

export async function hasProjectRole(
  userId: string,
  projectId: string,
  minimum: ProjectRole = 'VIEWER',
) {
  const role = await getProjectRole(userId, projectId)
  return role ? roleLevel[role] >= roleLevel[minimum] : false
}
