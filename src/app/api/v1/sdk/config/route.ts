import { apiError } from '@/lib/api'
import { authenticateSdkRequest, buildFlagCache } from '@/lib/sdk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const apiKey = await authenticateSdkRequest(request)
  if (!apiKey) return apiError('Invalid or revoked API key', 401)

  const cache = await buildFlagCache(apiKey.environmentId)
  if (!cache) return apiError('Environment not found', 404)

  return Response.json(cache, {
    headers: {
      'Cache-Control': 'private, no-store',
      ETag: `"${cache.version}"`,
    },
  })
}
