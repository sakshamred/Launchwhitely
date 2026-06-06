'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useActionState } from 'react'
import { ArrowLeft, ToggleLeft } from 'lucide-react'
import { createFlag } from '@/app/actions/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { FlagActionState } from '@/app/actions/projects'

const initialState: FlagActionState = null

const FLAG_TYPES = [
  { value: 'BOOLEAN', label: 'Boolean — on/off switch' },
  { value: 'STRING', label: 'String — text value' },
  { value: 'NUMBER', label: 'Number — numeric value' },
  { value: 'JSON', label: 'JSON — structured data' },
]

export default function NewFlagPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const boundAction = createFlag.bind(null, projectId)
  const [state, formAction, isPending] = useActionState(boundAction, initialState)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 flex-shrink-0">
        <Link
          href={`/projects/${projectId}`}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-zinc-100 font-semibold text-lg">New Feature Flag</h1>
      </div>

      <div className="p-6">
        <div className="max-w-lg mx-auto">
          {/* Intro */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-indigo-600/20 rounded-xl">
              <ToggleLeft className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-zinc-100 font-medium text-sm">Define a feature flag</p>
              <p className="text-zinc-500 text-xs">
                The key is immutable after creation. Choose it carefully.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            {state?.error && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{state.error}</p>
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <Input
                name="key"
                label="Flag Key"
                placeholder="e.g. checkout-v2, dark-mode"
                required
                autoFocus
                hint="Lowercase letters, numbers, and hyphens only. Cannot be changed later."
                error={state?.fieldErrors?.key}
              />

              <Input
                name="name"
                label="Display Name"
                placeholder="e.g. New Checkout Flow"
                required
                error={state?.fieldErrors?.name}
              />

              <Input
                name="description"
                label="Description"
                placeholder="What does this flag control? (optional)"
              />

              <Select name="type" label="Flag Type" defaultValue="BOOLEAN">
                {FLAG_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>

              <div className="pt-2 flex items-center gap-3">
                <Button type="submit" loading={isPending} className="flex-1 justify-center">
                  Create Flag
                </Button>
                <Link href={`/projects/${projectId}`}>
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
