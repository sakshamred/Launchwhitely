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
    'bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(79,70,229,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]',
  outline:
    'bg-white/[0.04] backdrop-blur-md border-white/10 text-zinc-100 hover:bg-white/[0.08] hover:border-white/20',
  ghost:
    'bg-transparent border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.07]',
  danger:
    'bg-red-600 hover:bg-red-500 text-white border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] disabled:hover:bg-red-600',
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
        'inline-flex items-center justify-center rounded-lg border font-medium',
        'transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
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