import { prisma } from '@/db/client'

export async function ensureProfile(user: { id: string; email?: string | null }) {
  if (!user.email) return

  await prisma.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email },
    update: { email: user.email },
  })
}
