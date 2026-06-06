'use client'

import { useState, useActionState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { inviteMember } from '@/app/actions/projects'
import type { MemberActionState } from '@/app/actions/projects'

interface InviteMemberButtonProps {
  organizationId: string
  projectId: string
}

const initialState: MemberActionState = null

export function InviteMemberButton({ organizationId, projectId }: InviteMemberButtonProps) {
  const [open, setOpen] = useState(false)

  const boundAction = inviteMember.bind(null, organizationId, projectId)
  const [state, formAction, isPending] = useActionState(boundAction, initialState)

  const handleClose = () => setOpen(false)

  // Close modal on success
  if (state?.success && open) {
    setOpen(false)
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
        title="Invite Member"
        footer={
          <>
            <Button variant="outline" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" form="invite-member-form" loading={isPending}>
              Send Invite
            </Button>
          </>
        }
      >
        {state?.error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{state.error}</p>
          </div>
        )}

        <form id="invite-member-form" action={formAction} className="space-y-4">
          <Input
            name="email"
            label="Email Address"
            type="email"
            placeholder="colleague@example.com"
            required
            autoFocus
            hint="The user must already have an account."
          />

          <Select name="role" label="Role" defaultValue="DEVELOPER">
            <option value="VIEWER">Viewer — read-only access</option>
            <option value="DEVELOPER">Developer — can manage flags</option>
            <option value="ADMIN">Admin — can manage members and settings</option>
            <option value="OWNER">Owner — full control</option>
          </Select>
        </form>
      </Modal>
    </>
  )
}
