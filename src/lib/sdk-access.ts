import type { FlagCache } from '@/lib/rollout'
import { prisma } from '@/db/client'
import { buildFlagCache } from '@/lib/sdk'
import { hashSdkKey } from './sdk-keys'

export type SdkProject = {
  id: string
  name: string
  slug: string
  sdkKeyPrefix: string
}

export type SdkEnvironment = {
  id: string
  name: string
  slug: string
  color: string
  sdkKeyPrefix: string
}

export type SdkBootstrapPayload = {
  project: SdkProject
  environment: SdkEnvironment
  cache: FlagCache
}

function readSdkKeyPair(request: Request) {
  const url = new URL(request.url)

  const projectKey =
    request.headers.get('x-launchwhitly-project-key')?.trim() ??
    request.headers.get('x-project-key')?.trim() ??
    url.searchParams.get('projectKey')?.trim() ??
    null

  const environmentKey =
    request.headers.get('x-launchwhitly-environment-key')?.trim() ??
    request.headers.get('x-environment-key')?.trim() ??
    url.searchParams.get('environmentKey')?.trim() ??
    null

  return { projectKey, environmentKey }
}

export async function resolveSdkAccess(request: Request): Promise<SdkBootstrapPayload | null> {
  const { projectKey, environmentKey } = readSdkKeyPair(request)
  if (!projectKey?.startsWith('lw_prj_') || !environmentKey?.startsWith('lw_env_')) {
    return null
  }

  const projectKeyHash = hashSdkKey(projectKey)
  const environmentKeyHash = hashSdkKey(environmentKey)

  const project = await prisma.project.findUnique({
    where: { sdkKeyHash: projectKeyHash },
    select: {
      id: true,
      name: true,
      slug: true,
      sdkKeyPrefix: true,
    },
  })
  if (!project || project.sdkKeyPrefix == null) return null

  const environment = await prisma.environment.findFirst({
    where: {
      projectId: project.id,
      sdkKeyHash: environmentKeyHash,
      sdkKeyRevokedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      sdkKeyPrefix: true,
    },
  })
  if (!environment || environment.sdkKeyPrefix == null) return null

  const cache = await buildFlagCache(environment.id)
  if (!cache) return null

  await prisma.project.update({
    where: { id: project.id },
    data: { sdkKeyLastUsedAt: new Date() },
  })
  await prisma.environment.update({
    where: { id: environment.id },
    data: { sdkKeyLastUsedAt: new Date() },
  })

  return {
    project,
    environment,
    cache,
  }
}
