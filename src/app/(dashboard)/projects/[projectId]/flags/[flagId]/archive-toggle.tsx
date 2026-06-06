'use client'

import { useState, useTransition } from 'react'
import { Archive, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { archiveFlag } from '@/app/actions/projects'

interface ArchiveToggleProps {
  flagId: string
  projectId: string
  archived: boolean
}

export function ArchiveToggle({ flagId, projectId, archived }: ArchiveToggleProps) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      await archiveFlag(flagId, !archived, projectId)
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      loading={isPending}
      onClick={handleClick}
      className="flex-shrink-0"
    >
      {archived ? (
        <>
          <ArchiveRestore className="h-3.5 w-3.5" />
          Unarchive
        </>
      ) : (
        <>
          <Archive className="h-3.5 w-3.5" />
          Archive
        </>
      )}
    </Button>
  )
}