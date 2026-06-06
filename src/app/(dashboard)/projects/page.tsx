import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, FolderKanban, ArrowUpRight, ToggleLeft, Globe } from 'lucide-react'
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
        subtitle={projects.length > 0 ? `${projects.length} project${projects.length !== 1 ? 's' : ''}` : undefined}
        actions={
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto bg-dots p-6">
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
          <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                style={{ ['--i' as string]: i }}
                className="group relative block bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)] hover:-translate-y-0.5"
              >
                <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-zinc-600 opacity-0 -translate-y-0.5 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:text-zinc-300" />

                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 border border-indigo-500/20 flex-shrink-0">
                    <FolderKanban className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-zinc-100 font-semibold text-sm truncate group-hover:text-white transition-colors">
                      {project.name}
                    </h2>
                    <p className="text-zinc-500 text-xs truncate">{project.organizationName}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-zinc-400 text-xs leading-relaxed mb-4 line-clamp-2 min-h-[2rem]">
                  {project.description || 'No description'}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-3 border-t border-zinc-800/80 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ToggleLeft className="h-3.5 w-3.5 text-zinc-600" />
                    {project._count.flags} flag{project._count.flags !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-zinc-600" />
                    {project._count.environments} env{project._count.environments !== 1 ? 's' : ''}
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