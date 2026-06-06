'use client'

import { useState, useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { saveFlagState } from '@/app/actions/projects'
import type { FlagStateActionState } from '@/app/actions/projects'

interface FlagStateEditorProps {
  flagId: string
  envId: string
  projectId: string
  initialEnabled: boolean
  initialRolloutPct: number
  rules: unknown[]
  variants: unknown[]
  version: number
}

const initialState: FlagStateActionState = null

export function FlagStateEditor({
  flagId,
  envId,
  projectId,
  initialEnabled,
  initialRolloutPct,
  rules,
  version,
}: FlagStateEditorProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [rolloutPct, setRolloutPct] = useState(initialRolloutPct)

  const boundAction = saveFlagState.bind(null, projectId)
  const [state, formAction, isPending] = useActionState(boundAction, initialState)

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden fields */}
      <input type="hidden" name="flagId" value={flagId} />
      <input type="hidden" name="envId" value={envId} />
      <input type="hidden" name="enabled" value={enabled ? '1' : '0'} />
      <input type="hidden" name="rolloutPct" value={String(rolloutPct)} />

      {/* Enabled toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-100 text-sm font-medium">Enabled</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {enabled ? 'Flag is active for this environment' : 'Flag is inactive — no users will see it'}
          </p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      {/* Rollout percentage */}
      <div>
        <Slider
          label="Rollout Percentage"
          value={rolloutPct}
          onChange={setRolloutPct}
          min={0}
          max={100}
          step={1}
        />
        <p className="text-zinc-600 text-xs mt-1">
          {rolloutPct === 100
            ? 'All users will see this flag'
            : rolloutPct === 0
              ? 'No users will see this flag (rollout at 0%)'
              : `${rolloutPct}% of users will see this flag`}
        </p>
      </div>

      {/* Targeting rules (read-only for now) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-zinc-300 text-sm font-medium">Targeting Rules</p>
          <span className="text-xs text-zinc-600">Edit via API</span>
        </div>
        {Array.isArray(rules) && rules.length > 0 ? (
          <pre className="text-xs font-mono text-zinc-400 bg-zinc-800 rounded-lg p-3 overflow-x-auto max-h-40">
            {JSON.stringify(rules, null, 2)}
          </pre>
        ) : (
          <div className="bg-zinc-800 rounded-lg px-4 py-3">
            <p className="text-zinc-600 text-xs">
              No targeting rules — rollout percentage applies to all users
            </p>
          </div>
        )}
      </div>

      {/* State info */}
      <div className="text-xs text-zinc-600">Version {version}</div>

      {/* Save feedback + button */}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={isPending}>
          Save Changes
        </Button>
        {state?.success && (
          <span className="flex items-center gap-1.5 text-green-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
        {state?.error && (
          <span className="text-red-400 text-sm">{state.error}</span>
        )}
      </div>
    </form>
  )
}
