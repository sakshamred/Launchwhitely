'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ArrowLeft, FolderKanban } from 'lucide-react'
import { createProject } from '@/app/actions/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ProjectActionState } from '@/app/actions/projects'

const initialState: ProjectActionState = null

export default function NewProjectPage() {
  const [state, formAction, isPending] = useActionState(createProject, initialState)

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