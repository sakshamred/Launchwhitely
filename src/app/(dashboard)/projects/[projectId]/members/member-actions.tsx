'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { updateMemberRole, removeMember } from '@/app/actions/projects'

type MemberRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER'

interface MemberActionsProps {
  memberId: string
  currentRole: MemberRole
  projectId: string
  memberName: string
}

export function MemberActions({
  memberId,
  currentRole,
  projectId,
  memberName,
}: MemberActionsProps) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value
    startTransition(async () => {
      await updateMemberRole(memberId, newRole, projectId)
    })
  }

  const handleRemove = () => {
    startTransition(async () => {
      await removeMember(memberId, projectId)
      setRemoveOpen(false)
    })
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <select
        defaultValue={currentRole}
        onChange={handleRoleChange}
        disabled={isPending}
        className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
      >
        <option value="VIEWER">Viewer</option>
        <option value="DEVELOPER">Developer</option>
        <option value="ADMIN">Admin</option>
        <option value="OWNER">Owner</option>
      </select>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setRemoveOpen(true)}
        disabled={isPending}
      >
        <Trash2 className="h-3.5 w-3.5 text-red-400" />
      </Button>

      <Modal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Remove Member"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={isPending} onClick={handleRemove}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-zinc-300 text-sm">
          Are you sure you want to remove{' '}
          <span className="font-semibold text-zinc-100">{memberName}</span> from this
          organization? They will lose access to all projects.
        </p>
      </Modal>
    </div>
  )
}
