import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, FolderKanban, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        include: {
          projects: {
            include: {
              _count: {
                select: { environments: true, flags: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  })

  const projects = memberships.flatMap((m) =>
    m.organization.projects.map((p) => ({
      ...p,
      organizationName: m.organization.name,
      role: m.role,
    })),
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Projects"
        actions={
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start managing feature flags."
            action={
              <Link href="/projects/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group block bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700 transition-all duration-150"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 bg-zinc-800/60 rounded-lg flex-shrink-0">
                      <FolderKanban className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div>
                      <h2 className="text-zinc-100 font-medium text-sm group-hover:text-white transition-colors">
                        {project.name}
                      </h2>
                      <p className="text-zinc-600 text-xs">{project.organizationName}</p>
                    </div>
                  </div>
                </div>

                {project.description && (
                  <p className="text-zinc-500 text-xs leading-relaxed mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-zinc-600">
                  <span>{project._count.environments} env{project._count.environments !== 1 ? 's' : ''}</span>
                  <span className="text-zinc-800">·</span>
                  <span>{project._count.flags} flag{project._count.flags !== 1 ? 's' : ''}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}