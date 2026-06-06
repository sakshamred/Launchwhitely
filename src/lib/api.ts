import { getCurrentUser, hasProjectRole, type ProjectRole } from '@/lib/auth'

export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export async function requireApiUser() {
  return getCurrentUser()
}

export async function canAccessProject(
  userId: string,
  projectId: string,
  minimum: ProjectRole = 'VIEWER',
) {
  return hasProjectRole(userId, projectId, minimum)
}

export function internalApiError(error: unknown) {
  console.error('[launchwhitly] API request failed', error)
  return apiError('Internal server error', 500)
}
