'use client'

import { useState, useActionState } from 'react'
import { UserPlus, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { createInvite, type CreateInviteState } from '@/app/actions/invites'

interface CreateInviteButtonProps {
  organizationId: string
  projectId: string
}

const initialState: CreateInviteState = null

export function CreateInviteButton({ organizationId, projectId }: CreateInviteButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const boundAction = createInvite.bind(null, organizationId, projectId)
  const [state, formAction, isPending] = useActionState(boundAction, initialState)

  const handleClose = () => {
    setOpen(false)
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!state?.invite) return
    try {
      await navigator.clipboard.writeText(state.invite.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // No-op: the URL is already displayed for manual copy.
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Invite Member
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title={state?.invite ? 'Invite sent' : 'Invite Member'}
        footer={
          state?.invite ? (
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" type="button" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" form="create-invite-form" loading={isPending}>
                Create Invite
              </Button>
            </>
          )
        }
      >
        {state?.error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{state.error}</p>
          </div>
        )}

        {state?.invite ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              Share this link with{' '}
              <span className="text-zinc-100 font-medium">{state.invite.email}</span>:
            </p>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={state.invite.url}
                className="flex-1 min-w-0 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-mono"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              The link expires in 7 days. The invitee must sign in with the email above to
              accept.
            </p>
          </div>
        ) : (
          <form id="create-invite-form" action={formAction} className="space-y-4">
            <Input
              name="email"
              label="Email Address"
              type="email"
              placeholder="colleague@example.com"
              required
              autoFocus
            />

            <Select name="role" label="Role" defaultValue="DEVELOPER">
              <option value="VIEWER">Viewer — read-only access</option>
              <option value="DEVELOPER">Developer — can manage flags</option>
              <option value="ADMIN">Admin — can manage members and settings</option>
              <option value="OWNER">Owner — full control</option>
            </Select>

            <p className="text-xs text-zinc-500">
              The invitee can sign in with Google even if they don&apos;t have a Launchwhitly
              account yet.
            </p>
          </form>
        )}
      </Modal>
    </>
  )
}
