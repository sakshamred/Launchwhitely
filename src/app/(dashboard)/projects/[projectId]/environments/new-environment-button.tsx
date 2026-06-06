'use client'

import { useActionState, useEffect, useState } from 'react'
import { CheckCheck, Copy, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { createEnvironment } from '@/app/actions/projects'
import type { EnvActionState } from '@/app/actions/projects'

interface NewEnvironmentButtonProps {
  projectId: string
}

const initialState: EnvActionState = null

const PRESET_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#6366f1',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
]

export function NewEnvironmentButton({ projectId }: NewEnvironmentButtonProps) {
  const [open, setOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[2])
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const boundAction = createEnvironment.bind(null, projectId)
  const [state, formAction, isPending] = useActionState(boundAction, initialState)

  const handleClose = () => {
    setOpen(false)
    setDismissed(true)
  }

  const handleCopy = async () => {
    if (!state?.rawKey) return
    await navigator.clipboard.writeText(state.rawKey)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (state?.rawKey) {
      setDismissed(false)
    }
  }, [state?.rawKey])

  if (state?.rawKey && state.environment && !dismissed) {
    return (
      <Modal
        open={true}
        onClose={handleClose}
        title="Environment Created"
        footer={<Button onClick={handleClose}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            <p className="text-amber-300 text-sm font-medium">
              Copy this SDK key now. It will not be shown again.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {state.environment.name}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-zinc-300 bg-zinc-800 rounded-lg px-3 py-2 break-all">
                {state.rawKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <CheckCheck className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New Environment
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Create Environment"
        footer={
          <>
            <Button variant="outline" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" form="new-env-form" loading={isPending}>
              Create
            </Button>
          </>
        }
      >
        {state?.error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{state.error}</p>
          </div>
        )}

        <form id="new-env-form" action={formAction} className="space-y-4">
          <Input
            name="name"
            label="Name"
            placeholder="e.g. Canary, QA, Preview"
            required
            autoFocus
          />

          <Input
            name="slug"
            label="Slug"
            placeholder="e.g. canary"
            required
            hint="Lowercase letters, numbers, and hyphens"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-300">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    selectedColor === color
                      ? 'border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none"
                title="Custom color"
              />
            </div>
            <input type="hidden" name="color" value={selectedColor} />
          </div>
        </form>
      </Modal>
    </>
  )
}
