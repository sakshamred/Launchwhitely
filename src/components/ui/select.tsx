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
        <label htmlFor={selectId} className="text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={[
          'bg-zinc-800 border text-zinc-100 rounded-lg px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'transition-colors',
          error ? 'border-red-500' : 'border-zinc-700 hover:border-zinc-600',
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
