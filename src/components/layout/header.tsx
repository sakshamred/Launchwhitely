import type { ReactNode } from 'react'

export interface HeaderProps {
  title: string
  actions?: ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 h-14 border-b border-zinc-800/60 flex-shrink-0">
      <h1 className="text-zinc-100 font-medium text-[15px]">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}