'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { ArrowLeft, CheckCheck, Copy, FolderKanban } from 'lucide-react'
import { createProject } from '@/app/actions/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ProjectActionState } from '@/app/actions/projects'

const initialState: ProjectActionState = null

export default function NewProjectPage() {
  const [state, formAction, isPending] = useActionState(createProject, initialState)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(null), 2000)
  }

  if (state?.project && state.projectKey && state.environments) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 h-14 border-b border-zinc-800/60 flex-shrink-0">
          <Link
            href="/projects"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-zinc-100 font-medium text-[15px]">New Project</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6">
              <div className="flex items-start gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <CheckCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-zinc-100 font-medium text-sm">Project created</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Store these SDK values in your app before wiring the client.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                    Project key
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-xs font-mono text-zinc-300 bg-zinc-900 rounded-lg px-3 py-2 break-all">
                      {state.projectKey.rawKey}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(state.projectKey!.rawKey, 'project')}
                    >
                      {copiedKey === 'project' ? (
                        <CheckCheck className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                    Project
                  </p>
                  <p className="text-zinc-100 font-medium">{state.project.name}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    Slug: <span className="font-mono text-zinc-400">{state.project.slug}</span>
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-zinc-100 font-medium text-sm">Default environments</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      Each environment gets its own SDK key.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {state.environments.map((environment) => (
                    <div
                      key={environment.id}
                      className="flex flex-col gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-zinc-100 font-medium text-sm">{environment.name}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          <span className="font-mono text-zinc-400">{environment.slug}</span>
                          {' '}SDK key
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-zinc-300 bg-zinc-900 rounded-lg px-3 py-2 break-all">
                          {environment.rawKey}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(environment.rawKey, environment.id)}
                        >
                          {copiedKey === environment.id ? (
                            <CheckCheck className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Link href={`/projects/${state.project.id}`}>
                  <Button>Go to project</Button>
                </Link>
                <Link href="/projects">
                  <Button type="button" variant="outline">
                    Back to projects
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-6 h-14 border-b border-zinc-800/60 flex-shrink-0">
        <Link
          href="/projects"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-zinc-100 font-medium text-[15px]">New Project</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 bg-zinc-800/60 rounded-xl">
              <FolderKanban className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <p className="text-zinc-100 font-medium text-sm">Create a new project</p>
              <p className="text-zinc-500 text-xs">
                Gets Production, Staging, and Development environments by default.
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
            {state?.error && (
              <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{state.error}</p>
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <Input
                name="name"
                label="Project Name"
                placeholder="My Awesome App"
                required
                autoFocus
                maxLength={80}
                error={state?.fieldErrors?.name}
              />

              <Input
                name="description"
                label="Description"
                placeholder="Optional — briefly describe what this project does"
                error={state?.fieldErrors?.description}
              />

              <div className="pt-2 flex items-center gap-3">
                <Button type="submit" loading={isPending} className="flex-1 justify-center">
                  Create Project
                </Button>
                <Link href="/projects">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
