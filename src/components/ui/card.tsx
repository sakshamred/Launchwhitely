import type { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  actions?: ReactNode
}

export function Card({ children, className = '', title, description, actions }: CardProps) {
  const hasHeader = Boolean(title ?? description ?? actions)

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-zinc-100 font-medium text-sm">{title}</h3>
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