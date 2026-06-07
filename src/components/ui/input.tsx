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
          'h-9 bg-white/[0.04] backdrop-blur-md border border-white/10 text-zinc-100 rounded-lg px-3 text-sm',
          'placeholder:text-zinc-600',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 focus:bg-white/[0.06]',
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