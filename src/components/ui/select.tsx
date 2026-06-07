import type { SelectHTMLAttributes, ReactNode } from 'react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

export function Select({ label, error, children, className = '', id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-zinc-400">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={[
          'h-9 bg-white/[0.04] backdrop-blur-md border border-white/10 text-zinc-100 rounded-lg px-3 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 focus:bg-white/[0.06]',
          'transition-all duration-150',
          error ? 'border-red-500/50 focus:ring-red-500/50' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}