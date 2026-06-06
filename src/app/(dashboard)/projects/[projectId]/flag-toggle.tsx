'use client'

import { useState, useTransition } from 'react'
import { Toggle } from '@/components/ui/toggle'
import { updateFlagState } from '@/app/actions/projects'

interface FlagToggleProps {
  flagId: string
  envId: string
  projectId: string
  initialEnabled: boolean
}

export function FlagToggle({ flagId, envId, projectId, initialEnabled }: FlagToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  const handleChange = (newValue: boolean) => {
    setEnabled(newValue) // optimistic update
    startTransition(async () => {
      await updateFlagState(flagId, envId, { enabled: newValue }, projectId)
    })
  }

  return (
    <Toggle
      checked={enabled}
      onChange={handleChange}
      disabled={isPending}
      size="sm"
    />
  )
}
