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
    'bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 disabled:hover:bg-zinc-100',
  outline:
    'bg-transparent border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 active:border-zinc-500',
  ghost:
    'bg-transparent border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:hover:bg-red-600',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-5 text-sm gap-2 rounded-lg',
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
        'inline-flex items-center justify-center border font-medium',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Loader2 className="animate-spin h-3.5 w-3.5 flex-shrink-0" />}
      {children}
    </button>
  )
}