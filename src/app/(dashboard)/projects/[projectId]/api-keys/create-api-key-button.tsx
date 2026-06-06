'use client'

import { useState, useActionState, useRef, useEffect } from 'react'
import { Plus, Copy, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { createApiKey } from '@/app/actions/projects'
import type { ApiKeyActionState } from '@/app/actions/projects'

interface Environment {
  id: string
  name: string
  color: string
}

interface CreateApiKeyButtonProps {
  projectId: string
  environments: Environment[]
}

const initialState: ApiKeyActionState = null

export function CreateApiKeyButton({ projectId, environments }: CreateApiKeyButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const boundAction = createApiKey.bind(null, projectId)
  const [state, formAction, isPending] = useActionState(boundAction, initialState)

  const handleCopy = async () => {
    if (!state?.rawKey) return
    await navigator.clipboard.writeText(state.rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setOpen(false)
    setDismissed(true)
  }

  useEffect(() => {
    if (state?.rawKey) {
      setDismissed(false)
    }
  }, [state?.rawKey])

  // If we have a raw key, show the "copy key" modal
  if (state?.rawKey && !dismissed) {
    return (
      <Modal
        open={true}
        onClose={handleClose}
        title="API Key Created"
        footer={
          <Button onClick={handleClose}>Done</Button>
        }
      >
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            <p className="text-amber-300 text-sm font-medium">
              Copy this key now — it will never be shown again.
            </p>
          </div>

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
      </Modal>
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create API Key
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Create API Key"
        footer={
          <>
            <Button variant="outline" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" form="new-api-key-form" loading={isPending}>
              Create Key
            </Button>
          </>
        }
      >
        {state?.error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{state.error}</p>
          </div>
        )}

        <form id="new-api-key-form" action={formAction} ref={formRef} className="space-y-4">
          <Input
            name="name"
            label="Key Name"
            placeholder="e.g. Production Frontend"
            required
            autoFocus
          />

          <Select name="environmentId" label="Environment" required>
            <option value="">Select an environment…</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </Select>

          <Select name="type" label="Key Type" defaultValue="SDK">
            <option value="SDK">SDK — client-side, read-only flag evaluation</option>
            <option value="SERVER">Server — server-side, full management access</option>
          </Select>
        </form>
      </Modal>
    </>
  )
}
