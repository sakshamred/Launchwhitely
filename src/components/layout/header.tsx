import type { ReactNode } from 'react'

export interface HeaderProps {
  title: string
  /** Small muted line under the title */
  subtitle?: string
  /** Rendered above the title, e.g. a breadcrumb link */
  eyebrow?: ReactNode
  /** JSX rendered on the right side of the header */
  actions?: ReactNode
}

export function Header({ title, subtitle, eyebrow, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 h-16 flex-shrink-0 border-b border-white/[0.07] bg-black/20 backdrop-blur-2xl">
      <div className="min-w-0">
        {eyebrow && <div className="mb-0.5">{eyebrow}</div>}
        <h1 className="text-zinc-50 font-semibold text-lg leading-tight tracking-tight truncate">
          {title}
        </h1>
        {subtitle && <p className="text-zinc-500 text-xs truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-shrink-0">{actions}</div>}
    </header>
  )
}