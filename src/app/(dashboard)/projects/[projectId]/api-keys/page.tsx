import { redirect } from 'next/navigation'
import { Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/client'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateApiKeyButton } from './create-api-key-button'
import { RevokeApiKeyButton } from './revoke-api-key-button'

type Props = {
  params: Promise<{ projectId: string }>
}

export default async function ApiKeysPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const environments = await prisma.environment.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, color: true },
  })

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      environmentId: { in: environments.map((e) => e.id) },
      revokedAt: null,
    },
    include: {
      environment: { select: { name: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="flex flex-col">
      <Header
        title="API Keys"
        actions={
          <CreateApiKeyButton projectId={projectId} environments={environments} />
        }
      />

      <div className="p-6">
        {apiKeys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No API keys"
            description="Create an API key to authenticate SDK requests or server-side integrations."
            action={
              <CreateApiKeyButton projectId={projectId} environments={environments} />
            }
          />
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Key Prefix
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Environment
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-zinc-100 font-medium">{key.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                        {key.keyPrefix}…
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={key.type === 'SDK' ? 'indigo' : 'warning'}>
                        {key.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: key.environment.color }}
                        />
                        <span className="text-zinc-400 text-xs">{key.environment.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {new Date(key.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RevokeApiKeyButton
                        keyId={key.id}
                        keyName={key.name}
                        projectId={projectId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}