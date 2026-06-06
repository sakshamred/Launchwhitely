'use client'

import { useState, useTransition } from 'react'
import { ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { revokeApiKey } from '@/app/actions/projects'

interface RevokeApiKeyButtonProps {
  keyId: string
  keyName: string
  projectId: string
}

export function RevokeApiKeyButton({ keyId, keyName, projectId }: RevokeApiKeyButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleRevoke = () => {
    startTransition(async () => {
      await revokeApiKey(keyId, projectId)
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <ShieldOff className="h-3.5 w-3.5 text-red-400" />
        Revoke
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Revoke API Key"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={isPending} onClick={handleRevoke}>
              Revoke Key
            </Button>
          </>
        }
      >
        <p className="text-zinc-300 text-sm">
          Are you sure you want to revoke{' '}
          <span className="font-semibold text-zinc-100">{keyName}</span>? Any applications
          using this key will immediately lose access. This action cannot be undone.
        </p>
      </Modal>
    </>
  )
}
