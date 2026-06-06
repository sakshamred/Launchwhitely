import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/db/client'
import { apiError, internalApiError, requireApiUser } from '@/lib/api'
import { generateSdkKey } from '@/lib/sdk-keys'

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
})

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  const user = await requireApiUser()
  if (!user) return apiError('Unauthorized', 401)

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              projects: {
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  description: true,
                  sdkKeyPrefix: true,
                  createdAt: true,
                  updatedAt: true,
                  _count: { select: { flags: true, environments: true } },
                },
              },
            },
          },
        },
  })

  return Response.json({
    data: memberships.flatMap((membership) =>
      membership.organization.projects.map((project) => ({
        ...project,
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
        },
        role: membership.role,
      })),
    ),
  })
}

export async function POST(request: Request) {
  const user = await requireApiUser()
  if (!user) return apiError('Unauthorized', 401)

  try {
    const parsed = createProjectSchema.safeParse(await request.json())
    if (!parsed.success) return apiError('Invalid project payload', 400)

    const slug = slugify(parsed.data.name)
    const projectKey = generateSdkKey('prj')
    const defaultEnvironments = [
      { name: 'Production', slug: 'production', color: '#22c55e', sortOrder: 0 },
      { name: 'Staging', slug: 'staging', color: '#f59e0b', sortOrder: 1 },
      { name: 'Development', slug: 'development', color: '#6366f1', sortOrder: 2 },
    ].map((environment) => ({
      ...environment,
      sdkKey: generateSdkKey('env'),
    }))

    const project = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: parsed.data.name,
          slug: `${slug}-${crypto.randomBytes(4).toString('hex')}`,
        },
      })
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId: user.id, role: 'OWNER' },
      })
      return tx.project.create({
        data: {
          organizationId: organization.id,
          name: parsed.data.name,
          slug,
          description: parsed.data.description || null,
          sdkKeyHash: projectKey.keyHash,
          sdkKeyPrefix: projectKey.keyPrefix,
          environments: {
            create: defaultEnvironments.map((environment) => ({
              name: environment.name,
              slug: environment.slug,
              color: environment.color,
              sortOrder: environment.sortOrder,
              sdkKeyHash: environment.sdkKey.keyHash,
              sdkKeyPrefix: environment.sdkKey.keyPrefix,
            })),
          },
        },
        include: { environments: true },
      })
    })

    return Response.json(
      {
        data: {
          project,
          projectKey: {
            rawKey: projectKey.rawKey,
            keyPrefix: projectKey.keyPrefix,
          },
          environmentKeys: defaultEnvironments.map((environment, index) => ({
            id: project.environments[index]?.id ?? '',
            name: environment.name,
            slug: environment.slug,
            rawKey: environment.sdkKey.rawKey,
            keyPrefix: environment.sdkKey.keyPrefix,
          })),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return internalApiError(error)
  }
}
