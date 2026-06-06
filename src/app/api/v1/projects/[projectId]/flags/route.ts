import { z } from 'zod'
import { prisma } from '@/db/client'
import { apiError, canAccessProject, internalApiError, requireApiUser } from '@/lib/api'

const createFlagSchema = z.object({
  key: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['BOOLEAN', 'STRING', 'NUMBER', 'JSON']).default('BOOLEAN'),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser()
  if (!user) return apiError('Unauthorized', 401)
  const { projectId } = await context.params
  if (!(await canAccessProject(user.id, projectId))) return apiError('Forbidden', 403)

  const flags = await prisma.flag.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: { states: true },
  })
  return Response.json({ data: flags })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser()
  if (!user) return apiError('Unauthorized', 401)
  const { projectId } = await context.params
  if (!(await canAccessProject(user.id, projectId, 'DEVELOPER'))) {
    return apiError('Forbidden', 403)
  }

  try {
    const parsed = createFlagSchema.safeParse(await request.json())
    if (!parsed.success) return apiError('Invalid flag payload', 400)

    const flag = await prisma.$transaction(async (tx) => {
      const environments = await tx.environment.findMany({
        where: { projectId },
        select: { id: true },
      })
      const created = await tx.flag.create({
        data: { projectId, ...parsed.data, description: parsed.data.description || null },
      })
      if (environments.length) {
        await tx.flagState.createMany({
          data: environments.map(({ id }) => ({ flagId: created.id, environmentId: id })),
        })
      }
      await tx.auditLog.create({
        data: {
          projectId,
          actorId: user.id,
          action: 'flag.created',
          resource: `flag:${created.key}`,
          newValue: parsed.data,
        },
      })
      return created
    })

    return Response.json({ data: flag }, { status: 201 })
  } catch (error) {
    return internalApiError(error)
  }
}
