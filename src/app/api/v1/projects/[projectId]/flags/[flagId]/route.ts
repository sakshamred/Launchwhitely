import { z } from 'zod'
import { prisma } from '@/db/client'
import { apiError, canAccessProject, internalApiError, requireApiUser } from '@/lib/api'

const patchFlagSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    archived: z.boolean().optional(),
    environmentId: z.string().uuid().optional(),
    enabled: z.boolean().optional(),
    rolloutPct: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.archived !== undefined ||
      value.enabled !== undefined ||
      value.rolloutPct !== undefined,
  )

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; flagId: string }> },
) {
  const user = await requireApiUser()
  if (!user) return apiError('Unauthorized', 401)
  const { projectId, flagId } = await context.params
  if (!(await canAccessProject(user.id, projectId, 'DEVELOPER'))) {
    return apiError('Forbidden', 403)
  }

  try {
    const parsed = patchFlagSchema.safeParse(await request.json())
    if (!parsed.success) return apiError('Invalid flag payload', 400)

    const existing = await prisma.flag.findFirst({ where: { id: flagId, projectId } })
    if (!existing) return apiError('Flag not found', 404)

    const { environmentId, enabled, rolloutPct, ...definition } = parsed.data
    await prisma.$transaction(async (tx) => {
      if (Object.keys(definition).length) {
        await tx.flag.update({ where: { id: flagId }, data: definition })
      }
      if (enabled !== undefined || rolloutPct !== undefined) {
        if (!environmentId) throw new Error('environmentId is required for state changes')
        const result = await tx.flagState.updateMany({
          where: {
            flagId,
            environmentId,
            environment: { projectId },
          },
          data: { enabled, rolloutPct, version: { increment: 1 } },
        })
        if (!result.count) throw new Error('Flag state not found')
      }
      await tx.auditLog.create({
        data: {
          projectId,
          actorId: user.id,
          action: 'flag.updated',
          resource: `flag:${existing.key}`,
          prevValue: {
            name: existing.name,
            description: existing.description,
            archived: existing.archived,
          },
          newValue: parsed.data,
        },
      })
    })

    return Response.json({ data: { id: flagId, ...parsed.data } })
  } catch (error) {
    return internalApiError(error)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; flagId: string }> },
) {
  const user = await requireApiUser()
  if (!user) return apiError('Unauthorized', 401)
  const { projectId, flagId } = await context.params
  if (!(await canAccessProject(user.id, projectId, 'DEVELOPER'))) {
    return apiError('Forbidden', 403)
  }

  const result = await prisma.flag.updateMany({
    where: { id: flagId, projectId },
    data: { archived: true },
  })
  if (!result.count) return apiError('Flag not found', 404)
  return new Response(null, { status: 204 })
}
