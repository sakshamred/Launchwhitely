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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-zinc-800 mb-4">
        <Icon className="h-7 w-7 text-zinc-400" />
      </div>
      <h3 className="text-zinc-100 font-semibold text-sm mb-1">{title}</h3>
      <p className="text-zinc-500 text-sm max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
