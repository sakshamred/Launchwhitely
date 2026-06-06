import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-zinc-400">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'h-9 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-3 text-sm',
          'placeholder:text-zinc-600',
          'focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-zinc-600',
          'transition-all duration-150',
          error ? 'border-red-500/50 focus:ring-red-500/50' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  )
}