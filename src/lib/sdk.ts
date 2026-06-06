import crypto from 'node:crypto'
import { prisma } from '@/db/client'
import type { FlagCache, FlagState, SegmentDef } from '@/lib/rollout'

function readApiKey(request: Request) {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim()

  const headerKey = request.headers.get('x-api-key')
  if (headerKey) return headerKey.trim()

  return new URL(request.url).searchParams.get('sdkKey')?.trim() ?? null
}

export async function authenticateSdkRequest(request: Request) {
  const rawKey = readApiKey(request)
  if (!rawKey?.startsWith('lw_')) return null

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      environmentId: true,
      type: true,
      revokedAt: true,
    },
  })

  if (!apiKey || apiKey.revokedAt) return null

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  })

  return apiKey
}

export async function buildFlagCache(environmentId: string): Promise<FlagCache | null> {
  const environment = await prisma.environment.findUnique({
    where: { id: environmentId },
    include: {
      flagStates: {
        include: { flag: true },
      },
      segments: true,
    },
  })

  if (!environment) return null

  const flags: Record<string, FlagState> = {}
  for (const state of environment.flagStates) {
    if (state.flag.archived) continue
    flags[state.flag.key] = {
      flagKey: state.flag.key,
      enabled: state.enabled,
      rolloutPct: state.rolloutPct,
      rules: state.rules as unknown as FlagState['rules'],
      variants: state.variants as unknown as FlagState['variants'],
      defaultValue: state.defaultValue,
    }
  }

  const segments: Record<string, SegmentDef> = {}
  for (const segment of environment.segments) {
    segments[segment.key] = {
      key: segment.key,
      rules: segment.rules as unknown as SegmentDef['rules'],
    }
  }

  const version = Math.max(
    environment.updatedAt.getTime(),
    ...environment.flagStates.map((state) => state.updatedAt.getTime()),
    ...environment.flagStates.map((state) => state.flag.updatedAt.getTime()),
    ...environment.segments.map((segment) => segment.updatedAt.getTime()),
  )

  return { environmentId, version, flags, segments }
}
