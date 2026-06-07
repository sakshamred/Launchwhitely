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
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/10 mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
        <Icon className="h-5 w-5 text-indigo-300" />
      </div>
      <h3 className="text-zinc-200 font-medium text-sm mb-1">{title}</h3>
      <p className="text-zinc-500 text-sm max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}