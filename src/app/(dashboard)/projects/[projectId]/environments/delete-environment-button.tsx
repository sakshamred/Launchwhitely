'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { deleteEnvironment } from '@/app/actions/projects'

interface DeleteEnvironmentButtonProps {
  envId: string
  envName: string
  projectId: string
}

export function DeleteEnvironmentButton({
  envId,
  envName,
  projectId,
}: DeleteEnvironmentButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      await deleteEnvironment(envId, projectId)
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5 text-red-400" />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete Environment"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={isPending} onClick={handleDelete}>
              Delete Environment
            </Button>
          </>
        }
      >
        <p className="text-zinc-300 text-sm">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-zinc-100">{envName}</span>? This will also
          delete all flag states and API keys associated with this environment. This action
          cannot be undone.
        </p>
      </Modal>
    </>
  )
}
