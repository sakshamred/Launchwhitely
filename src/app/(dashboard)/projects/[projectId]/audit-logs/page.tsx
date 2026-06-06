import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

const PER_PAGE = 50

type Props = {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ page?: string }>
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    'flag.enabled': 'Enabled flag',
    'flag.disabled': 'Disabled flag',
    'flag.created': 'Created flag',
    'flag.updated': 'Updated flag',
    'flag.archived': 'Archived flag',
    'flag.unarchived': 'Unarchived flag',
    'flag.rollout_updated': 'Updated rollout percentage',
    'flag.rules_updated': 'Updated targeting rules',
    'environment.created': 'Created environment',
    'environment.updated': 'Updated environment',
    'environment.deleted': 'Deleted environment',
    'apikey.created': 'Created API key',
    'apikey.revoked': 'Revoked API key',
    'member.invited': 'Invited member',
    'member.removed': 'Removed member',
    'member.role_updated': 'Updated member role',
    'project.created': 'Created project',
    'project.updated': 'Updated project',
  }
  return map[action] ?? action.replace(/[._]/g, ' ')
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export default async function AuditLogsPage({ params, searchParams }: Props) {
  const { projectId } = await params
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      include: {
        actor: { select: { email: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where: { projectId } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="flex flex-col">
      <Header title="Audit Log" />

      <div className="p-6">
        {logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit events"
            description="Actions performed by members will appear here."
          />
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Action
                    </th>
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                      When
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          {log.actor.name && (
                            <p className="text-zinc-200 text-sm font-medium">{log.actor.name}</p>
                          )}
                          <p className={`text-xs ${log.actor.name ? 'text-zinc-600' : 'text-zinc-300'}`}>
                            {log.actor.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 text-sm">
                        {formatAction(log.action)}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                          {log.resource}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="text-zinc-600 text-xs"
                          title={new Date(log.createdAt).toISOString()}
                        >
                          {formatRelativeTime(new Date(log.createdAt))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-zinc-600 text-xs">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total} events
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/projects/${projectId}/audit-logs?page=${page - 1}`}
                    aria-disabled={!hasPrev}
                    tabIndex={hasPrev ? undefined : -1}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasPrev}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </Button>
                  </Link>
                  <span className="text-zinc-600 text-xs">
                    Page {page} of {totalPages}
                  </span>
                  <Link
                    href={`/projects/${projectId}/audit-logs?page=${page + 1}`}
                    aria-disabled={!hasNext}
                    tabIndex={hasNext ? undefined : -1}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasNext}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}