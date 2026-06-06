import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasProjectRole } from '@/lib/auth'
import { prisma } from '@/db/client'
import { EnvSwitcher } from '@/components/env-switcher'

type Props = {
  children: ReactNode
  params: Promise<{ projectId: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ProjectLayout({ children, params }: Props) {
  const { projectId } = await params

  if (!UUID_RE.test(projectId)) redirect('/projects')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await hasProjectRole(user.id, projectId))) redirect('/projects')

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      environments: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, slug: true, color: true },
      },
    },
  })

  if (!project) redirect('/projects')

  const environments = project.environments
  const defaultEnvId = environments[0]?.id ?? ''

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 h-11 border-b border-zinc-800/60 bg-black/40 flex-shrink-0">
        <span className="text-zinc-300 text-sm font-medium">{project.name}</span>
        {environments.length > 0 && (
          <Suspense
            fallback={
              <div className="h-7 w-32 bg-zinc-800/40 rounded-md animate-pulse" />
            }
          >
            <EnvSwitcher
              environments={environments}
              current={defaultEnvId}
              projectId={projectId}
            />
          </Suspense>
        )}
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}