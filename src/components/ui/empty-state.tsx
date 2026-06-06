import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800/60 mb-4">
        <Icon className="h-5 w-5 text-zinc-500" />
      </div>
      <h3 className="text-zinc-200 font-medium text-sm mb-1">{title}</h3>
      <p className="text-zinc-500 text-sm max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}