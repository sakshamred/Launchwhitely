import type { ReactNode } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'indigo' | 'custom'

export interface BadgeProps {
  variant?: Variant
  color?: string
  children: ReactNode
  className?: string
}

const variantClasses: Record<Exclude<Variant, 'custom'>, string> = {
  default: 'bg-white/[0.06] text-zinc-300 border-white/10 backdrop-blur-md',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
}

const base =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border tracking-wide uppercase'

export function Badge({ variant = 'default', color, children, className = '' }: BadgeProps) {
  if (variant === 'custom' && color) {
    return (
      <span
        className={`${base} ${className}`}
        style={{
          backgroundColor: `${color}15`,
          color,
          borderColor: `${color}30`,
        }}
      >
        {children}
      </span>
    )
  }

  return (
    <span className={`${base} ${variantClasses[variant as Exclude<Variant, 'custom'>]} ${className}`}>
      {children}
    </span>
  )
}