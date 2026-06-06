import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/client'
import { EnvSwitcher } from '@/components/env-switcher'

type Props = {
  children: ReactNode
  params: Promise<{ projectId: string }>
}

export default async function ProjectLayout({ children, params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
      {/* Project top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
        <span className="text-zinc-100 font-medium text-sm">{project.name}</span>
        {environments.length > 0 && (
          <Suspense
            fallback={
              <div className="h-8 w-36 bg-zinc-800 rounded-lg animate-pulse" />
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

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
