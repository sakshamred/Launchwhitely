import type { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  /** JSX rendered in the card header's right slot */
  actions?: ReactNode
}

export function Card({ children, className = '', title, description, actions }: CardProps) {
  const hasHeader = Boolean(title ?? description ?? actions)

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-zinc-100 font-semibold text-sm">{title}</h3>
            )}
            {description && (
              <p className="text-zinc-500 text-xs mt-0.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
