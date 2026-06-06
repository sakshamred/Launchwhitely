'use client'

import { useTransition } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { revokeInvite } from '@/app/actions/invites'

interface Props {
  inviteId: string
  projectId: string
}

export function RevokeInviteButton({ inviteId, projectId }: Props) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() => {
        if (!confirm('Revoke this invite? The link will stop working.')) return
        startTransition(() => {
          void revokeInvite(inviteId, projectId)
        })
      }}
    >
      <X className="h-3.5 w-3.5" />
      Revoke
    </Button>
  )
}
