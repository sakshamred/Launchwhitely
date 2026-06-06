'use client'

import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'default' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  default:
    'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent disabled:hover:bg-indigo-600',
  outline:
    'bg-transparent border-zinc-700 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-600',
  ghost:
    'bg-transparent border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
  danger:
    'bg-red-600 hover:bg-red-500 text-white border-transparent disabled:hover:bg-red-600',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-lg border font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Loader2 className="animate-spin h-4 w-4 flex-shrink-0" />}
      {children}
    </button>
  )
}
