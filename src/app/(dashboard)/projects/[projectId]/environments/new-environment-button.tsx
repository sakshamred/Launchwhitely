'use client'

import { useState, useActionState } from 'react'
import { Plus } from 'lucide-react'
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
  '#22c55e', // green
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
]

export function NewEnvironmentButton({ projectId }: NewEnvironmentButtonProps) {
  const [open, setOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[2])

  const boundAction = createEnvironment.bind(null, projectId)
  const [state, formAction, isPending] = useActionState(boundAction, initialState)

  const handleClose = () => {
    setOpen(false)
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

          {/* Color picker */}
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
