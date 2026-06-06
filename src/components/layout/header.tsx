import type { ReactNode } from 'react'

export interface HeaderProps {
  title: string
  /** JSX rendered on the right side of the header */
  actions?: ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
      <h1 className="text-zinc-100 font-semibold text-lg">{title}</h1>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
