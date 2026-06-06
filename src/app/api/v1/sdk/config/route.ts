import { apiError } from '@/lib/api'
import { resolveSdkAccess } from '@/lib/sdk-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const access = await resolveSdkAccess(request)
  if (!access) return apiError('Invalid or revoked SDK keys', 401)

  return Response.json(
    {
      project: access.project,
      environment: access.environment,
      cache: access.cache,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        ETag: `"${access.cache.version}"`,
      },
    },
  )
}
